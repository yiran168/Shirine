# Permissions & Points System

Shirine features an engaging user progression and content access control system.

---

## 1. User Roles

- **Superadmin (`superadmin`)**: Highest privileges. Automatically assigned to the first registered user.
- **Admin (`admin`)**: Can manage posts, albums, moments, and approve friend links.
- **User (`user`)**: Can check in daily, earn points, unlock exclusive content, and select preset anime avatars.

---

## 2. Daily Check-in Engine

Configurable via admin panel:
- **Fixed Points Mode**: Awards a fixed amount of points (e.g. 10) per daily check-in.
- **Random Range Mode**: Randomly awards points in $[min, max]$ range (e.g. 5 ~ 25) with a cryptographic PRNG.
- Tracks consecutive streak days and cumulative check-ins.

---

## 3. 3-Tier Content Permissions

- **Public**: Accessible to all visitors.
- **Login Required**: Visible only to authenticated users. Guests see a frosted glass overlay and a login card.
- **Points Required**: Costs points to permanently unlock. Atomic transaction deduction and confetti celebration upon unlock.
