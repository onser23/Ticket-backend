const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const auth = require("../middleware/auth");
const authOrAdmin = require("../middleware/authOrAdmin");
const upload = require("../middleware/upload");
const { ALLOWED_MIMES, ALLOWED_EXTS } = require("../middleware/upload");
const { body, validationResult } = require("express-validator");

const ticketValidation = [
  body("title")
    .trim()
    .isLength({ min: 3, max: 150 })
    .withMessage("Başlıq 3-150 simvol aralığında olmalıdır"),
  body("description")
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Açıqlama 10-2000 simvol aralığında olmalıdır"),
  body("priority")
    .isIn(["low", "medium", "high"])
    .withMessage("Prioritet low/medium/high olmalıdır"),
];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validasiya xətası",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

function cleanupFiles(req) {
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {}
    }
  }
}

// POST /api/tickets — create ticket (user)
router.post(
  "/",
  auth,
  upload.array("attachments", 5),
  ticketValidation,
  handleValidation,
  async (req, res, next) => {
    try {
      // Validate attachments mime/ext (after multer accepted themm)
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const ext = path.extname(file.originalname).toLowerCase();
          if (
            !ALLOWED_MIMES.includes(file.mimetype) ||
            !ALLOWED_EXTS.includes(ext)
          ) {
            cleanupFiles(req);
            return res.status(400).json({
              success: false,
              message:
                "Yalnız şəkil faylları (jpg, jpeg, png, webp, gif) qəbul olunur",
            });
          }
        }
      }

      const user = await User.findById(req.userId);
      if (!user || !user.companyId) {
        cleanupFiles(req);
        return res
          .status(400)
          .json({ success: false, message: "İstifadəçiyə şirkət bağlı deyil" });
      }

      const attachments = (req.files || []).map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: `tickets/${file.filename}`,
      }));

      const ticket = await Ticket.create({
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        companyId: user.companyId,
        createdBy: req.userId,
        attachments,
      });

      const populated = await Ticket.findById(ticket._id)
        .populate("createdBy", "firstName lastName email")
        .populate("companyId", "displayName");

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      cleanupFiles(req);
      next(err);
    }
  },
);

// GET /api/tickets — list (user own OR admin all, filterable)
router.get("/", authOrAdmin, async (req, res, next) => {
  try {
    const {
      status,
      priority,
      dateFrom,
      dateTo,
      search,
      companyId,
      page = 1,
      limit = 20,
    } = req.query;
    const query = { isActive: true };

    if (req.userRole === "admin") {
      // Admin: all tickets, optionally filter by companyId
      if (companyId) query.companyId = companyId;
    } else {
      // User: only own tickets
      query.createdBy = req.userId;
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }
    if (search && search.trim()) {
      query.$or = [
        { title: new RegExp(search.trim(), "i") },
        { description: new RegExp(search.trim(), "i") },
        { displayId: new RegExp(search.trim(), "i") },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [total, tickets] = await Promise.all([
      Ticket.countDocuments(query),
      Ticket.find(query)
        .populate("createdBy", "firstName lastName email")
        .populate("companyId", "displayName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
    ]);

    res.json({
      success: true,
      data: tickets,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets/:id — single ticket (both roles)
router.get("/:id", authOrAdmin, async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("createdBy", "firstName lastName email")
      .populate("companyId", "displayName");

    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Müraciət tapılmadı" });
    }

    const isOwner = ticket.createdBy._id.toString() === req.userId;
    const isAdmin = req.userRole === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Bu müraciətə baxmaq hüququnuz yoxdur",
      });
    }

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tickets/:id/status (admin)
router.patch(
  "/:id/status",
  require("../middleware/adminAuth"),
  async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!["pending", "in_progress", "resolved"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status pending/in_progress/resolved olmalıdır",
        });
      }

      const ticket = await Ticket.findById(req.params.id).populate(
        "createdBy",
        "firstName lastName email",
      );
      if (!ticket || !ticket.isActive) {
        return res
          .status(404)
          .json({ success: false, message: "Müraciət tapılmadı" });
      }

      const previousStatus = ticket.status;
      ticket.status = status;
      if (status === "resolved") {
        ticket.resolvedAt = new Date();
      } else {
        ticket.resolvedAt = null;
      }
      await ticket.save();

      // Send status changed email — only when status CHANGES TO resolved
      if (
        status === "resolved" &&
        previousStatus !== "resolved" &&
        ticket.createdBy?.email
      ) {
        const { sendStatusChangedEmail } = require("../services/emailService");
        sendStatusChangedEmail({
          to: ticket.createdBy.email,
          firstName: ticket.createdBy.firstName,
          ticket: ticket.toObject(),
        });
      }

      const populated = await Ticket.findById(ticket._id)
        .populate("createdBy", "firstName lastName email")
        .populate("companyId", "displayName");

      res.json({ success: true, data: populated, message: "Status yeniləndi" });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/tickets/:id (admin, soft delete)
router.delete(
  "/:id",
  require("../middleware/adminAuth"),
  async (req, res, next) => {
    try {
      const ticket = await Ticket.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true },
      );
      if (!ticket) {
        return res
          .status(404)
          .json({ success: false, message: "Müraciət tapılmadı" });
      }
      res.json({ success: true, message: "Müraciət deaktiv edildi" });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
