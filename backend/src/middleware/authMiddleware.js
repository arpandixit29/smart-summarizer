const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const rawAuthorization = req.headers.authorization || "";

    if (!rawAuthorization) {
      return res.status(401).json({ success: false, error: "No token provided." });
    }

    const token = rawAuthorization.startsWith("Bearer ")
      ? rawAuthorization.slice(7)
      : rawAuthorization;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Invalid token." });
  }
};

module.exports = authMiddleware;
