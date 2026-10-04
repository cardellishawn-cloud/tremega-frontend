// src/middleware/rbac.js
// Role-based access control for the agent API.
//
// Role vocabulary: owner > pm > field.
//
// The users table predates this vocabulary (roles: admin/contractor/sub/client),
// so resolveRole normalizes:
//   1. User ids listed in the OWNER_IDS env var (comma-separated) are 'owner'
//      — checked first, wins over any stored role. Read at request time.
//   2. Stored role already in the new vocabulary (owner/pm/field) passes through.
//   3. Legacy roles map: admin -> owner, contractor -> pm.
//   4. Anything else (sub, client, missing) -> 'field'.

const ROLE_RANK = { owner: 3, pm: 2, field: 1 };

const LEGACY_ROLE_MAP = {
  admin: 'owner',
  contractor: 'pm',
};

const resolveRole = (user) => {
  if (!user) return null;
  const userId = user.userId || user.id;

  const ownerIds = (process.env.OWNER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (userId && ownerIds.includes(String(userId))) return 'owner';

  const role = user.role;
  if (role && Object.prototype.hasOwnProperty.call(ROLE_RANK, role)) return role;
  if (role && LEGACY_ROLE_MAP[role]) return LEGACY_ROLE_MAP[role];
  return 'field';
};

// requireRole('owner', 'pm') — allows any of the listed roles.
// Must run after middleware/auth.js (needs req.user).
const requireRole = (...roles) => (req, res, next) => {
  const role = resolveRole(req.user);
  if (!role) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
  }
  if (!roles.includes(role)) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: `This action requires one of: ${roles.join(', ')}. Your role: ${role}.`,
      },
    });
  }
  req.userRole = role;
  return next();
};

module.exports = { requireRole, resolveRole, ROLE_RANK };
