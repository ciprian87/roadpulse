import { pool } from "@/lib/db";

export interface UserListRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean | null;
  last_active_at: string | null;
  created_at: string;
  route_check_count: number;
  report_count: number;
}

export interface UserListParams {
  search?: string;
  role?: string;
  limit?: number;
  offset?: number;
}

export interface UserListResult {
  users: UserListRow[];
  total: number;
}

export interface UserDetail extends UserListRow {
  saved_route_count: number;
}

export interface UserGrowthPoint {
  date: string;
  count: number;
}

export interface UserSegments {
  active: number;
  inactive: number;
  admins: number;
  drivers: number;
  dispatchers: number;
}

export async function listUsers(params: UserListParams = {}): Promise<UserListResult> {
  const client = await pool.connect();
  try {
    const { search, role, limit = 50, offset = 0 } = params;

    const conditions: string[] = [];
    const args: unknown[] = [];
    let argIdx = 1;

    if (search) {
      conditions.push(`(u.email ILIKE $${argIdx} OR u.name ILIKE $${argIdx})`);
      args.push(`%${search}%`);
      argIdx++;
    }
    if (role) {
      conditions.push(`u.role = $${argIdx}`);
      args.push(role);
      argIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await client.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM users u ${where}`,
      args
    );

    const dataResult = await client.query<UserListRow>(
      `SELECT
         u.id, u.email, u.name, u.role, u.is_active, u.last_active_at::text, u.created_at::text,
         COUNT(DISTINCT ue.id) FILTER (WHERE ue.event_type = 'ROUTE_CHECK') AS route_check_count,
         COUNT(DISTINCT cr.id) AS report_count
       FROM users u
       LEFT JOIN usage_events ue ON ue.user_id = u.id
       LEFT JOIN community_reports cr ON cr.user_id = u.id
       ${where}
       GROUP BY u.id, u.email, u.name, u.role, u.is_active, u.last_active_at, u.created_at
       ORDER BY u.created_at DESC
       LIMIT $${argIdx} OFFSET $${argIdx + 1}`,
      [...args, limit, offset]
    );

    return {
      users: dataResult.rows.map((r) => ({
        ...r,
        route_check_count: parseInt(String(r.route_check_count), 10),
        report_count: parseInt(String(r.report_count), 10),
      })),
      total: parseInt(countResult.rows[0].total, 10),
    };
  } finally {
    client.release();
  }
}

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<UserDetail>(
      `SELECT
         u.id, u.email, u.name, u.role, u.is_active, u.last_active_at::text, u.created_at::text,
         COUNT(DISTINCT ue.id) FILTER (WHERE ue.event_type = 'ROUTE_CHECK') AS route_check_count,
         COUNT(DISTINCT cr.id) AS report_count,
         COUNT(DISTINCT sr.id) AS saved_route_count
       FROM users u
       LEFT JOIN usage_events ue ON ue.user_id = u.id
       LEFT JOIN community_reports cr ON cr.user_id = u.id
       LEFT JOIN saved_routes sr ON sr.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id, u.email, u.name, u.role, u.is_active, u.last_active_at, u.created_at`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      ...r,
      route_check_count: parseInt(String(r.route_check_count), 10),
      report_count: parseInt(String(r.report_count), 10),
      saved_route_count: parseInt(String(r.saved_route_count), 10),
    };
  } finally {
    client.release();
  }
}

export async function updateUser(
  id: string,
  data: { role?: string; is_active?: boolean }
): Promise<void> {
  const client = await pool.connect();
  try {
    const sets: string[] = ["updated_at = NOW()"];
    const args: unknown[] = [id];
    let idx = 2;

    if (data.role !== undefined) {
      sets.push(`role = $${idx++}`);
      args.push(data.role);
    }
    if (data.is_active !== undefined) {
      sets.push(`is_active = $${idx++}`);
      args.push(data.is_active);
    }

    await client.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $1`,
      args
    );
  } finally {
    client.release();
  }
}

export async function getUserGrowthSeries(days: number): Promise<UserGrowthPoint[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ date: string; count: string }>(
      `SELECT
         DATE_TRUNC('day', created_at)::date::text AS date,
         COUNT(*) AS count
       FROM users
       WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
       GROUP BY 1
       ORDER BY 1`,
      [days]
    );
    return result.rows.map((r) => ({ date: r.date, count: parseInt(r.count, 10) }));
  } finally {
    client.release();
  }
}

export async function getUserSegments(): Promise<UserSegments> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      role: string;
      is_active: boolean | null;
      count: string;
    }>(
      `SELECT role, is_active, COUNT(*) AS count
       FROM users
       GROUP BY role, is_active`
    );

    const segments: UserSegments = {
      active: 0,
      inactive: 0,
      admins: 0,
      drivers: 0,
      dispatchers: 0,
    };

    for (const row of result.rows) {
      const count = parseInt(row.count, 10);
      if (row.is_active !== false) segments.active += count;
      else segments.inactive += count;

      if (row.role === "admin") segments.admins += count;
      else if (row.role === "driver") segments.drivers += count;
      else if (row.role === "dispatcher") segments.dispatchers += count;
    }

    return segments;
  } finally {
    client.release();
  }
}
