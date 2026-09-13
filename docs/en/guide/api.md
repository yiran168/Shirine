# REST API Documentation

All Shirine endpoints return standard JSON responses:

```json
{
  "success": true,
  "data": { ... },
  "error": "Error message when unsuccessful"
}
```

---

## Core Endpoints

- `POST /api/auth/register` - User registration (first user becomes superadmin)
- `POST /api/auth/login` - User login (returns JWT token)
- `GET /api/auth/me` - Current user profile & points
- `POST /api/user/checkin` - Daily check-in
- `GET /api/posts` - List posts
- `GET /api/posts/:slugOrId` - Get post detail
- `POST /api/posts/:id/unlock` - Unlock post with points
- `POST /api/posts` - Create post (Admin)
- `PUT /api/posts/:id` - Update post (Admin)
- `DELETE /api/posts/:id` - Delete post (Admin)
- `GET /api/albums` - List albums
- `POST /api/albums/:id/unlock` - Unlock album with points
- `GET /api/admin/stats` - Admin dashboard stats
- `PUT /api/admin/users/:id/points` - Adjust user points
- `POST /api/upload` - Upload image to Cloudflare R2
