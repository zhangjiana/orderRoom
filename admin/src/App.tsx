import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  Modal,
  Segmented,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  adminLogin,
  clearAdminToken,
  clearMerchantToken,
  createMerchantRoom,
  createRoom,
  getAdminDashboard,
  getAdminToken,
  getMerchantToken,
  getStoredRole,
  listAdminBookings,
  listAdminMerchants,
  listApplications,
  listMerchantBookings,
  listMerchantRooms,
  loadAdminSession,
  loadMerchantSession,
  logoutAdmin,
  logoutMerchant,
  merchantWebLogin,
  reviewApplication,
  setStoredRole,
  updateAdminBookingStatus,
  updateMerchantBookingStatus,
  updateMerchantRoom,
  type WebRole,
} from "./api";
import type {
  AdminDashboard,
  AdminMerchant,
  AdminRoom,
  AdminSession,
  AdminUser,
  BookingFilter,
  MerchantApplication,
  MerchantBooking,
  MerchantSession,
} from "./types";

const { Content } = Layout;

const statusOptions: Array<{ label: string; value: BookingFilter }> = [
  { label: "全部", value: "all" },
  { label: "待确认", value: "pending" },
  { label: "已确认", value: "confirmed" },
  { label: "已拒绝", value: "rejected" },
];

function statusColor(status: string) {
  if (status === "confirmed" || status === "approved" || status === "active") return "green";
  if (status === "rejected") return "red";
  return "gold";
}

function canReview(booking: MerchantBooking) {
  return booking.rawStatus === "pending";
}

// ===================== Merchant Panel =====================

function MerchantPanel() {
  const [form] = Form.useForm<{ username: string; password: string }>();
  const [roomForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [token, setToken] = useState(() => getMerchantToken());
  const [session, setSession] = useState<MerchantSession | null>(null);
  const [bookings, setBookings] = useState<MerchantBooking[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loadingSession, setLoadingSession] = useState(Boolean(token));
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [actingBookingId, setActingBookingId] = useState("");
  const [actingRoomId, setActingRoomId] = useState("");
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<MerchantBooking | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingFilter>("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const deferredKeyword = useDeferredValue(searchKeyword);

  useEffect(() => {
    let cancelled = false;
    if (!token) { setLoadingSession(false); setSession(null); return; }
    setLoadingSession(true);
    loadMerchantSession(token)
      .then((r) => { if (!cancelled) setSession(r); })
      .catch((e) => {
        if (!cancelled) { clearMerchantToken(); setToken(""); setSession(null); messageApi.error(e.message || "商家登录状态已失效"); }
      })
      .finally(() => { if (!cancelled) setLoadingSession(false); });
    return () => { cancelled = true; };
  }, [messageApi, token]);

  useEffect(() => {
    if (!token || !session) { setBookings([]); return; }
    let cancelled = false;
    setLoadingBookings(true);
    listMerchantBookings(token, statusFilter)
      .then((r) => { if (!cancelled) setBookings(r.items); })
      .catch((e) => { if (!cancelled) messageApi.error(e.message || "订单加载失败"); })
      .finally(() => { if (!cancelled) setLoadingBookings(false); });
    return () => { cancelled = true; };
  }, [messageApi, session, statusFilter, token]);

  useEffect(() => {
    if (!token || !session) { setRooms([]); return; }
    let cancelled = false;
    setLoadingRooms(true);
    listMerchantRooms(token)
      .then((r) => { if (!cancelled) setRooms(r.items); })
      .catch((e) => { if (!cancelled) messageApi.error(e.message || "包间加载失败"); })
      .finally(() => { if (!cancelled) setLoadingRooms(false); });
    return () => { cancelled = true; };
  }, [messageApi, session, token]);

  const filteredBookings = useMemo(() => {
    const kw = deferredKeyword.trim().toLowerCase();
    if (!kw) return bookings;
    return bookings.filter((b) =>
      b.roomName.toLowerCase().includes(kw) ||
      b.contactName.toLowerCase().includes(kw) ||
      b.contactPhone.includes(kw) ||
      b.occasion.toLowerCase().includes(kw),
    );
  }, [bookings, deferredKeyword]);

  const summary = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter((b) => b.rawStatus === "pending").length,
    confirmed: bookings.filter((b) => b.rawStatus === "confirmed").length,
    upcoming: bookings.filter((b) => b.rawStatus === "pending" || b.rawStatus === "confirmed").length,
  }), [bookings]);

  const columns = useMemo<ColumnsType<MerchantBooking>>(() => [
    {
      title: "预订信息", key: "booking", render: (_, b) => (
        <div><div className="table-title">{b.roomName}</div><div className="table-meta">{b.diningDate} {b.diningTime} · {b.guestCount} 位</div><div className="table-meta">{b.occasion}</div></div>
      ),
    },
    { title: "客户", key: "contact", render: (_, b) => (<div><div className="table-title">{b.contactName}</div><div className="table-meta">{b.contactPhone}</div></div>) },
    { title: "预算", dataIndex: "budget", key: "budget", width: 110, render: (v: number) => <span>¥{v}</span> },
    { title: "状态", key: "status", width: 120, render: (_, b) => <Tag color={statusColor(b.rawStatus)}>{b.statusLabel}</Tag> },
    {
      title: "操作", key: "actions", width: 230, render: (_, b) => (
        <Space wrap>
          <Button onClick={() => setSelectedBooking(b)}>详情</Button>
          <Button type="primary" disabled={!canReview(b)} loading={actingBookingId === `${b.id}:confirmed`} onClick={() => void handleReview(b, "confirmed")}>确认</Button>
          <Button danger disabled={!canReview(b)} loading={actingBookingId === `${b.id}:rejected`} onClick={() => void handleReview(b, "rejected")}>拒绝</Button>
        </Space>
      ),
    },
  ], [actingBookingId]);

  const roomColumns = useMemo<ColumnsType<AdminRoom>>(() => [
    { title: "包间", key: "name", render: (_, r) => <div><div className="table-title">{r.name}</div><div className="table-meta">{r.tags?.join(", ") || "无标签"}</div></div> },
    { title: "容量", key: "capacity", width: 120, render: (_, r) => `${r.capacityMin}-${r.capacityMax} 位` },
    { title: "最低消费", key: "minSpend", width: 120, render: (_, r) => <span>¥{r.minSpend}</span> },
    { title: "状态", key: "status", width: 100, render: (_, r) => <Tag color={r.status === "available" ? "green" : "gold"}>{r.status === "available" ? "可预订" : "已下架"}</Tag> },
    {
      title: "操作", key: "actions", width: 130, render: (_, r) => (
        <Button
          size="small"
          loading={actingRoomId === r.id}
          onClick={() => void handleToggleRoom(r)}
        >
          {r.status === "available" ? "下架" : "上架"}
        </Button>
      ),
    },
  ], [actingRoomId, messageApi, token]);

  async function handleLogin(values: { username: string; password: string }) {
    setSubmittingLogin(true);
    try {
      const result = await merchantWebLogin(values.username, values.password);
      startTransition(() => { setToken(result.token); setSession({ merchant: result.merchant, staff: result.staff, expiresAt: result.expiresAt }); });
      messageApi.success(`欢迎回来，${result.staff.displayName}`);
    } catch (e) { messageApi.error(e instanceof Error ? e.message : "登录失败"); }
    finally { setSubmittingLogin(false); }
  }

  async function handleReview(b: MerchantBooking, status: "confirmed" | "rejected") {
    if (!token) return;
    setActingBookingId(`${b.id}:${status}`);
    try {
      const updated = await updateMerchantBookingStatus(token, b.id, status);
      startTransition(() => {
        setBookings((c) => c.map((i) => (i.id === updated.id ? updated : i)));
        setSelectedBooking((c) => (c && c.id === updated.id ? updated : c));
      });
      messageApi.success(status === "confirmed" ? "订单已确认" : "订单已拒绝");
    } catch (e) { messageApi.error(e instanceof Error ? e.message : "操作失败"); }
    finally { setActingBookingId(""); }
  }

  async function handleAddMerchantRoom() {
    if (!token) return;
    try {
      const values = await roomForm.validateFields();
      setSavingRoom(true);
      const room = await createMerchantRoom(token, {
        name: values.name,
        capacityMin: values.capacityMin,
        capacityMax: values.capacityMax,
        minSpend: values.minSpend,
        description: values.description || "",
        tags: values.tags ? String(values.tags).split(",").map((item) => item.trim()).filter(Boolean) : [],
      });
      setRooms((current) => [room, ...current]);
      setRoomModalOpen(false);
      roomForm.resetFields();
      messageApi.success("包间已创建");
    } catch (e) { if (e instanceof Error) messageApi.error(e.message); }
    finally { setSavingRoom(false); }
  }

  async function handleToggleRoom(room: AdminRoom) {
    if (!token) return;
    setActingRoomId(room.id);
    try {
      const updated = await updateMerchantRoom(token, room.id, {
        status: room.status === "available" ? "paused" : "available",
      });
      setRooms((current) => current.map((item) => item.id === updated.id ? updated : item));
      messageApi.success(updated.status === "available" ? "包间已上架" : "包间已下架");
    } catch (e) { messageApi.error(e instanceof Error ? e.message : "操作失败"); }
    finally { setActingRoomId(""); }
  }

  async function handleLogout() {
    if (token) { try { await logoutMerchant(token); } catch { clearMerchantToken(); } }
    clearMerchantToken(); setToken(""); setSession(null); setBookings([]); setRooms([]); setSelectedBooking(null); form.resetFields();
  }

  if (loadingSession) return <div className="shell shell--center">{contextHolder}<Spin size="large" tip="正在恢复商家会话..." /></div>;

  if (!session) {
    return (
      <div className="shell shell--center">
        {contextHolder}
        <Card className="auth-card" bordered={false} style={{ maxWidth: 440, width: "100%" }}>
          <Typography.Text className="eyebrow">MERCHANT WEB</Typography.Text>
          <Typography.Title level={2}>商家后台登录</Typography.Title>
          <Form form={form} layout="vertical" onFinish={(v) => void handleLogin(v)}>
            <Form.Item label="商家账号" name="username" rules={[{ required: true, message: "请输入账号" }]}>
              <Input size="large" placeholder="请输入商家账号" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password size="large" placeholder="请输入登录密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={submittingLogin}>登录商家后台</Button>
          </Form>
        </Card>
      </div>
    );
  }

  return (
    <Layout className="shell">
      {contextHolder}
      <Content className="content">
        <div className="hero">
          <div>
            <Typography.Text className="eyebrow">MERCHANT CONSOLE</Typography.Text>
            <Typography.Title>{session.merchant.name}</Typography.Title>
            <Typography.Paragraph>{session.staff.displayName} · {session.merchant.address}</Typography.Paragraph>
          </div>
          <Space wrap>
            <Button onClick={() => setStatusFilter("all")}>重置筛选</Button>
            <Button onClick={() => void handleLogout()}>退出登录</Button>
          </Space>
        </div>

        <div className="stats-grid">
          <Card bordered={false}><Statistic title="订单总数" value={summary.total} /></Card>
          <Card bordered={false}><Statistic title="待确认" value={summary.pending} /></Card>
          <Card bordered={false}><Statistic title="已确认" value={summary.confirmed} /></Card>
          <Card bordered={false}><Statistic title="活跃订单" value={summary.upcoming} /></Card>
        </div>

        <Card bordered={false} className="panel-card">
          <div className="toolbar">
            <Typography.Title level={4} style={{ margin: 0 }}>包间管理</Typography.Title>
            <Button type="primary" onClick={() => setRoomModalOpen(true)}>新建包间</Button>
          </div>
          <Table rowKey="id" columns={roomColumns} dataSource={rooms} loading={loadingRooms} locale={{ emptyText: <Empty description="还没有包间" /> }} pagination={{ pageSize: 6, showSizeChanger: false }} />
        </Card>

        <Card bordered={false} className="panel-card">
          <div className="toolbar">
            <Segmented options={statusOptions} value={statusFilter} onChange={(v) => setStatusFilter(v as BookingFilter)} />
            <Input className="search-input" placeholder="搜索联系人、手机号、包间" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} />
          </div>
          <Table rowKey="id" columns={columns} dataSource={filteredBookings} loading={loadingBookings} locale={{ emptyText: <Empty description="当前没有符合条件的订单" /> }} pagination={{ pageSize: 8, showSizeChanger: false }} />
        </Card>
      </Content>

      <Drawer title={selectedBooking ? `${selectedBooking.roomName} · ${selectedBooking.statusLabel}` : "订单详情"} open={Boolean(selectedBooking)} width={520} onClose={() => setSelectedBooking(null)}>
        {selectedBooking ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="用餐时间">{selectedBooking.diningDate} {selectedBooking.diningTime}</Descriptions.Item>
            <Descriptions.Item label="人数">{selectedBooking.guestCount} 位</Descriptions.Item>
            <Descriptions.Item label="联系人">{selectedBooking.contactName} / {selectedBooking.contactPhone}</Descriptions.Item>
            <Descriptions.Item label="场景">{selectedBooking.occasion}</Descriptions.Item>
            <Descriptions.Item label="预算">¥{selectedBooking.budget}</Descriptions.Item>
            <Descriptions.Item label="门店">{selectedBooking.merchantName}</Descriptions.Item>
            <Descriptions.Item label="地址">{selectedBooking.merchantAddress}</Descriptions.Item>
            <Descriptions.Item label="备注">{selectedBooking.remarks || "无"}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{selectedBooking.createdAt}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{selectedBooking.updatedAt}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>

      <Modal title="新建包间" open={roomModalOpen} onCancel={() => { setRoomModalOpen(false); roomForm.resetFields(); }} onOk={() => void handleAddMerchantRoom()} confirmLoading={savingRoom} okText="创建">
        <Form form={roomForm} layout="vertical">
          <Form.Item label="包间名称" name="name" rules={[{ required: true, message: "请输入包间名称" }]}>
            <Input placeholder="如：牡丹厅" />
          </Form.Item>
          <Space style={{ width: "100%" }}>
            <Form.Item label="最少人数" name="capacityMin" rules={[{ required: true, message: "必填" }]}>
              <InputNumber min={1} placeholder="4" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item label="最多人数" name="capacityMax" rules={[{ required: true, message: "必填" }]}>
              <InputNumber min={1} placeholder="12" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item label="最低消费" name="minSpend" rules={[{ required: true, message: "必填" }]}>
              <InputNumber min={0} placeholder="1000" style={{ width: 120 }} />
            </Form.Item>
          </Space>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="包间特色描述（选填）" rows={2} />
          </Form.Item>
          <Form.Item label="标签" name="tags">
            <Input placeholder="中式,商务,圆桌（英文逗号分隔）" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

// ===================== Admin Panel =====================

function AdminPanel() {
  const [form] = Form.useForm<{ username: string; password: string }>();
  const [roomForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [token, setToken] = useState(() => getAdminToken());
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(token));
  const [submittingLogin, setSubmittingLogin] = useState(false);

  // Data
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [merchants, setMerchants] = useState<AdminMerchant[]>([]);
  const [bookings, setBookings] = useState<MerchantBooking[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [appFilter, setAppFilter] = useState("all");
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
  const [actingId, setActingId] = useState("");
  const [selectedMerchant, setSelectedMerchant] = useState<AdminMerchant | null>(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) { setLoadingSession(false); setAdmin(null); return; }
    setLoadingSession(true);
    loadAdminSession(token)
      .then((r) => { if (!cancelled) setAdmin(r.admin); })
      .catch((e) => { if (!cancelled) { clearAdminToken(); setToken(""); setAdmin(null); messageApi.error(e.message || "管理员登录已失效"); } })
      .finally(() => { if (!cancelled) setLoadingSession(false); });
    return () => { cancelled = true; };
  }, [messageApi, token]);

  useEffect(() => {
    if (!token || !admin) return;
    loadTabData(activeTab);
  }, [admin, activeTab, token, appFilter, bookingFilter]);

  async function loadTabData(tab: string) {
    if (!token) return;
    setLoadingData(true);
    try {
      if (tab === "dashboard") {
        const d = await getAdminDashboard(token);
        setDashboard(d);
      } else if (tab === "applications") {
        const r = await listApplications(token, appFilter);
        setApplications(r.items);
      } else if (tab === "merchants") {
        const r = await listAdminMerchants(token);
        setMerchants(r.items);
      } else if (tab === "bookings") {
        const r = await listAdminBookings(token, bookingFilter);
        setBookings(r.items);
      }
    } catch (e) { messageApi.error(e instanceof Error ? e.message : "数据加载失败"); }
    finally { setLoadingData(false); }
  }

  async function handleLogin(values: { username: string; password: string }) {
    setSubmittingLogin(true);
    try {
      const result = await adminLogin(values.username, values.password);
      startTransition(() => { setToken(result.token); setAdmin(result.admin); });
      messageApi.success(`欢迎回来，${result.admin.displayName}`);
    } catch (e) { messageApi.error(e instanceof Error ? e.message : "登录失败"); }
    finally { setSubmittingLogin(false); }
  }

  async function handleLogout() {
    if (token) { try { await logoutAdmin(token); } catch { clearAdminToken(); } }
    clearAdminToken(); setToken(""); setAdmin(null); form.resetFields();
  }

  async function handleReviewApp(id: string, status: "approved" | "rejected") {
    if (!token) return;
    setActingId(`${id}:${status}`);
    try {
      const result = await reviewApplication(token, id, status);
      if (status === "approved" && result.merchantStaff) {
        Modal.success({
          title: "已通过并开通商家账号",
          content: (
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="登录账号">{result.merchantStaff.username}</Descriptions.Item>
              <Descriptions.Item label="绑定手机号">{result.merchantStaff.phone}</Descriptions.Item>
              <Descriptions.Item label="显示名称">{result.merchantStaff.displayName}</Descriptions.Item>
              <Descriptions.Item label="初始密码">
                {result.merchantStaff.initialPassword || "已存在账号，请使用原密码登录"}
              </Descriptions.Item>
            </Descriptions>
          ),
          okText: "知道了",
        });
      } else {
        messageApi.success(status === "approved" ? "已通过" : "已拒绝");
      }
      await loadTabData("applications");
    } catch (e) { messageApi.error(e instanceof Error ? e.message : "操作失败"); }
    finally { setActingId(""); }
  }

  async function handleBookingAction(bookingId: string, status: string) {
    if (!token) return;
    setActingId(`${bookingId}:${status}`);
    try {
      await updateAdminBookingStatus(token, bookingId, status);
      messageApi.success("订单状态已更新");
      await loadTabData("bookings");
    } catch (e) { messageApi.error(e instanceof Error ? e.message : "操作失败"); }
    finally { setActingId(""); }
  }

  async function handleAddRoom() {
    if (!token || !selectedMerchant) return;
    try {
      const values = await roomForm.validateFields();
      setAddingRoom(true);
      await createRoom(token, selectedMerchant.id, {
        name: values.name,
        capacityMin: values.capacityMin,
        capacityMax: values.capacityMax,
        minSpend: values.minSpend,
        description: values.description || "",
        tags: values.tags ? String(values.tags).split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      });
      messageApi.success("包间已添加");
      roomForm.resetFields();
      setRoomModalOpen(false);
      await loadTabData("merchants");
    } catch (e) { if (e instanceof Error) messageApi.error(e.message); }
    finally { setAddingRoom(false); }
  }

  // --- Columns ---

  const appColumns = useMemo<ColumnsType<MerchantApplication>>(() => [
    { title: "商家名称", dataIndex: "merchantName", key: "merchantName" },
    { title: "申请人", key: "applicant", render: (_, r) => <div><div>{r.applicantName}</div><div className="table-meta">{r.phone}</div></div> },
    { title: "地址", dataIndex: "address", key: "address", ellipsis: true },
    { title: "状态", key: "status", width: 100, render: (_, r) => <Tag color={statusColor(r.status)}>{r.status === "pending" ? "待审核" : r.status === "approved" ? "已通过" : "已拒绝"}</Tag> },
    { title: "申请时间", dataIndex: "createdAt", key: "createdAt", width: 170 },
    {
      title: "操作", key: "actions", width: 200, render: (_, r) => r.status === "pending" ? (
        <Space>
          <Button type="primary" size="small" loading={actingId === `${r.id}:approved`} onClick={() => void handleReviewApp(r.id, "approved")}>通过</Button>
          <Button danger size="small" loading={actingId === `${r.id}:rejected`} onClick={() => void handleReviewApp(r.id, "rejected")}>拒绝</Button>
        </Space>
      ) : <span className="table-meta">{r.reviewedAt}</span>,
    },
  ], [actingId]);

  const merchantColumns = useMemo<ColumnsType<AdminMerchant>>(() => [
    { title: "商家名称", dataIndex: "name", key: "name" },
    { title: "负责人", key: "owner", render: (_, r) => <div><div>{r.ownerName}</div><div className="table-meta">{r.phone}</div></div> },
    { title: "地址", dataIndex: "address", key: "address", ellipsis: true },
    { title: "包间", key: "rooms", width: 80, render: (_, r) => <Badge count={r.roomCount} showZero color="gold" /> },
    { title: "状态", key: "status", width: 100, render: (_, r) => <Tag color={statusColor(r.status)}>{r.status === "active" ? "营业中" : r.status}</Tag> },
    {
      title: "操作", key: "actions", width: 140, render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => setSelectedMerchant(r)}>详情</Button>
          <Button size="small" type="primary" onClick={() => { setSelectedMerchant(r); setRoomModalOpen(true); }}>添加包间</Button>
        </Space>
      ),
    },
  ], []);

  const bookingColumns = useMemo<ColumnsType<MerchantBooking>>(() => [
    {
      title: "预订", key: "booking", render: (_, b) => (
        <div><div className="table-title">{b.merchantName} · {b.roomName}</div><div className="table-meta">{b.diningDate} {b.diningTime} · {b.guestCount} 位</div></div>
      ),
    },
    { title: "客户", key: "contact", render: (_, b) => <div><div>{b.contactName}</div><div className="table-meta">{b.contactPhone}</div></div> },
    { title: "预算", dataIndex: "budget", key: "budget", width: 100, render: (v: number) => <span>¥{v}</span> },
    { title: "状态", key: "status", width: 100, render: (_, b) => <Tag color={statusColor(b.rawStatus)}>{b.statusLabel}</Tag> },
    {
      title: "操作", key: "actions", width: 200, render: (_, b) => canReview(b) ? (
        <Space>
          <Button type="primary" size="small" loading={actingId === `${b.id}:confirmed`} onClick={() => void handleBookingAction(b.id, "confirmed")}>确认</Button>
          <Button danger size="small" loading={actingId === `${b.id}:rejected`} onClick={() => void handleBookingAction(b.id, "rejected")}>拒绝</Button>
        </Space>
      ) : <span className="table-meta">{b.statusLabel}</span>,
    },
  ], [actingId]);

  if (loadingSession) return <div className="shell shell--center">{contextHolder}<Spin size="large" tip="正在恢复管理员会话..." /></div>;

  if (!admin) {
    return (
      <div className="shell shell--center">
        {contextHolder}
        <Card className="auth-card" bordered={false} style={{ maxWidth: 440, width: "100%" }}>
          <Typography.Text className="eyebrow">PLATFORM ADMIN</Typography.Text>
          <Typography.Title level={2}>平台管理后台</Typography.Title>
          <Form form={form} layout="vertical" onFinish={(v) => void handleLogin(v)}>
            <Form.Item label="管理员账号" name="username" rules={[{ required: true, message: "请输入账号" }]}>
              <Input size="large" placeholder="请输入管理员账号" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password size="large" placeholder="请输入密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={submittingLogin}>登录管理后台</Button>
          </Form>
        </Card>
      </div>
    );
  }

  return (
    <Layout className="shell">
      {contextHolder}
      <Content className="content">
        <div className="hero">
          <div>
            <Typography.Text className="eyebrow">PLATFORM ADMIN</Typography.Text>
            <Typography.Title>宴请宾朋管理后台</Typography.Title>
            <Typography.Paragraph>{admin.displayName} · {admin.role}</Typography.Paragraph>
          </div>
          <Button onClick={() => void handleLogout()}>退出登录</Button>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: "dashboard", label: "仪表盘",
            children: dashboard ? (
              <div className="stats-grid">
                <Card bordered={false}><Statistic title="入驻申请" value={dashboard.summary.totalApplications} /></Card>
                <Card bordered={false}><Statistic title="待审核" value={dashboard.summary.pendingApplications} /></Card>
                <Card bordered={false}><Statistic title="活跃商家" value={dashboard.summary.activeMerchants} /></Card>
                <Card bordered={false}><Statistic title="总包间数" value={dashboard.summary.totalRooms} /></Card>
                <Card bordered={false}><Statistic title="全平台订单" value={dashboard.summary.totalBookings} /></Card>
                <Card bordered={false}><Statistic title="待确认订单" value={dashboard.summary.pendingBookings} /></Card>
              </div>
            ) : <Spin />,
          },
          {
            key: "applications", label: <span>入驻审核 {dashboard && dashboard.summary.pendingApplications > 0 ? <Badge count={dashboard.summary.pendingApplications} size="small" offset={[6, -2]} /> : null}</span>,
            children: (
              <Card bordered={false} className="panel-card">
                <div className="toolbar">
                  <Segmented options={[{ label: "全部", value: "all" }, { label: "待审核", value: "pending" }, { label: "已通过", value: "approved" }, { label: "已拒绝", value: "rejected" }]} value={appFilter} onChange={(v) => setAppFilter(v as string)} />
                </div>
                <Table rowKey="id" columns={appColumns} dataSource={applications} loading={loadingData} locale={{ emptyText: <Empty description="没有申请记录" /> }} pagination={{ pageSize: 8 }} />
              </Card>
            ),
          },
          {
            key: "merchants", label: "商家管理",
            children: (
              <Card bordered={false} className="panel-card">
                <Table rowKey="id" columns={merchantColumns} dataSource={merchants} loading={loadingData} locale={{ emptyText: <Empty description="暂无商家" /> }} pagination={{ pageSize: 8 }} />
              </Card>
            ),
          },
          {
            key: "bookings", label: "全平台订单",
            children: (
              <Card bordered={false} className="panel-card">
                <div className="toolbar">
                  <Segmented options={statusOptions} value={bookingFilter} onChange={(v) => setBookingFilter(v as BookingFilter)} />
                </div>
                <Table rowKey="id" columns={bookingColumns} dataSource={bookings} loading={loadingData} locale={{ emptyText: <Empty description="没有订单" /> }} pagination={{ pageSize: 8 }} />
              </Card>
            ),
          },
        ]} />
      </Content>

      {/* Merchant Detail Drawer */}
      <Drawer title={selectedMerchant?.name || "商家详情"} open={Boolean(selectedMerchant) && !roomModalOpen} width={560} onClose={() => setSelectedMerchant(null)}>
        {selectedMerchant ? (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="负责人">{selectedMerchant.ownerName}</Descriptions.Item>
              <Descriptions.Item label="手机号">{selectedMerchant.phone}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{selectedMerchant.contactPhone}</Descriptions.Item>
              <Descriptions.Item label="地址">{selectedMerchant.address}</Descriptions.Item>
              <Descriptions.Item label="营业时间">{selectedMerchant.businessHours}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColor(selectedMerchant.status)}>{selectedMerchant.status === "active" ? "营业中" : selectedMerchant.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="入驻时间">{selectedMerchant.createdAt}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} style={{ marginTop: 24 }}>包间列表 ({selectedMerchant.rooms.length})</Typography.Title>
            {selectedMerchant.rooms.length > 0 ? (
              <Table rowKey="id" size="small" pagination={false} dataSource={selectedMerchant.rooms} columns={[
                { title: "名称", dataIndex: "name", key: "name" },
                { title: "容量", key: "cap", render: (_, r) => `${r.capacityMin}-${r.capacityMax} 位` },
                { title: "最低消费", key: "min", render: (_, r) => `¥${r.minSpend}` },
                { title: "标签", key: "tags", render: (_, r) => r.tags?.join(", ") || "-" },
              ]} />
            ) : <Empty description="暂无包间" />}
            <Button type="primary" style={{ marginTop: 16 }} onClick={() => setRoomModalOpen(true)}>添加包间</Button>
          </>
        ) : null}
      </Drawer>

      {/* Add Room Modal */}
      <Modal title={`为 ${selectedMerchant?.name || ""} 添加包间`} open={roomModalOpen} onCancel={() => { setRoomModalOpen(false); roomForm.resetFields(); }} onOk={() => void handleAddRoom()} confirmLoading={addingRoom} okText="添加">
        <Form form={roomForm} layout="vertical">
          <Form.Item label="包间名称" name="name" rules={[{ required: true, message: "请输入包间名称" }]}>
            <Input placeholder="如：牡丹厅" />
          </Form.Item>
          <Space style={{ width: "100%" }}>
            <Form.Item label="最少人数" name="capacityMin" rules={[{ required: true, message: "必填" }]}>
              <InputNumber min={1} placeholder="4" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item label="最多人数" name="capacityMax" rules={[{ required: true, message: "必填" }]}>
              <InputNumber min={1} placeholder="12" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item label="最低消费" name="minSpend" rules={[{ required: true, message: "必填" }]}>
              <InputNumber min={0} placeholder="1000" style={{ width: 120 }} />
            </Form.Item>
          </Space>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="包间特色描述（选填）" rows={2} />
          </Form.Item>
          <Form.Item label="标签" name="tags">
            <Input placeholder="中式,商务,圆桌（英文逗号分隔）" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

// ===================== App Root =====================

export default function App() {
  const [role, setRole] = useState<WebRole>(() => getStoredRole());

  function switchRole(newRole: WebRole) {
    setStoredRole(newRole);
    setRole(newRole);
  }

  return (
    <>
      <div className="role-switcher">
        <Segmented
          options={[
            { label: "商家后台", value: "merchant" },
            { label: "平台管理", value: "admin" },
          ]}
          value={role}
          onChange={(v) => switchRole(v as WebRole)}
        />
      </div>
      {role === "admin" ? <AdminPanel /> : <MerchantPanel />}
    </>
  );
}
