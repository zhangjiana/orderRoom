import { useEffect, useMemo, useState } from "react";
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Layout,
  List,
  Menu,
  Modal,
  Row,
  Select,
  Segmented,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ApartmentOutlined,
  AuditOutlined,
  CalendarOutlined,
  DashboardOutlined,
  LogoutOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import type {
  AdminAuthResponse,
  AdminDashboard,
  AdminUser,
  Booking,
  BookingStatus,
  Merchant,
  MerchantApplication,
  MerchantApplicationStatus,
  RoomFormState,
} from "./types";

const { Header, Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;
const STORAGE_KEY = "yanqing-admin-token";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

type ViewKey = "overview" | "applications" | "merchants" | "bookings";

const navItems = [
  { key: "overview" as const, icon: <DashboardOutlined />, label: "总览" },
  { key: "applications" as const, icon: <AuditOutlined />, label: "入驻审核" },
  { key: "merchants" as const, icon: <ShopOutlined />, label: "商家资产" },
  { key: "bookings" as const, icon: <CalendarOutlined />, label: "订单流转" },
];

const applicationFilterOptions = [
  { label: "全部申请", value: "all" },
  { label: "待审核", value: "pending" },
  { label: "已通过", value: "approved" },
  { label: "已拒绝", value: "rejected" },
] as const;

const bookingFilterOptions = [
  { label: "全部订单", value: "all" },
  { label: "待确认", value: "pending" },
  { label: "已确认", value: "confirmed" },
  { label: "已拒绝", value: "rejected" },
  { label: "已完成", value: "completed" },
] as const;

const emptySummary: AdminDashboard["summary"] = {
  totalApplications: 0,
  pendingApplications: 0,
  approvedApplications: 0,
  activeMerchants: 0,
  totalRooms: 0,
};

const emptyRoomForm: RoomFormState = {
  name: "",
  capacityMin: "",
  capacityMax: "",
  minSpend: "",
  description: "",
  tags: "",
};

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit, token = ""): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "请求失败" }));
    throw new ApiError(response.status, payload.message || "请求失败");
  }

  return response.json();
}

function getStatusTagColor(status: string): string {
  const map: Record<string, string> = {
    pending: "gold",
    approved: "green",
    confirmed: "green",
    completed: "blue",
    rejected: "red",
    cancelled: "default",
  };

  return map[status] || "default";
}

function getApplicationStatusLabel(status: MerchantApplicationStatus): string {
  return {
    pending: "待审核",
    approved: "已通过",
    rejected: "已拒绝",
  }[status];
}

function AppInner() {
  const { message, modal } = AntdApp.useApp();
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [dashboard, setDashboard] = useState<AdminDashboard>({ summary: emptySummary });
  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [applicationFilter, setApplicationFilter] = useState<MerchantApplicationStatus | "all">("all");
  const [bookingFilter, setBookingFilter] = useState<BookingStatus | "all">("all");
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [roomForm, setRoomForm] = useState<RoomFormState>(emptyRoomForm);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [submittingRoom, setSubmittingRoom] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [sessionExpiry, setSessionExpiry] = useState("");
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [currentApplication, setCurrentApplication] = useState<MerchantApplication | null>(null);
  const [reviewRemark, setReviewRemark] = useState("");
  const [loginForm] = Form.useForm<{ username: string; password: string }>();
  const [roomFormInstance] = Form.useForm<RoomFormState>();

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.id === selectedMerchantId) ?? merchants[0] ?? null,
    [merchants, selectedMerchantId],
  );

  const latestApplications = applications.slice(0, 5);
  const latestBookings = bookings.slice(0, 5);
  const pendingBookings = bookings.filter((booking) => booking.status === "pending");

  useEffect(() => {
    if (import.meta.env.DEV) {
      loginForm.setFieldsValue({
        username: "admin",
        password: "Admin@123456",
      });
    }
    void restoreSession();
  }, []);

  useEffect(() => {
    if (adminUser) {
      void loadBootstrap();
    }
  }, [adminUser]);

  async function restoreSession() {
    const storedToken = localStorage.getItem(STORAGE_KEY) || "";

    if (!storedToken) {
      setAuthLoading(false);
      return;
    }

    try {
      const response = await request<{ admin: AdminUser; expiresAt: string }>(
        "/api/admin/auth/me",
        undefined,
        storedToken,
      );
      setAuthToken(storedToken);
      setAdminUser(response.admin);
      setSessionExpiry(response.expiresAt);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setAuthLoading(false);
    }
  }

  async function authedRequest<T>(url: string, init?: RequestInit) {
    return request<T>(url, init, authToken);
  }

  function handleRequestError(error: unknown, fallback: string) {
    if (error instanceof ApiError && error.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      setAuthToken("");
      setAdminUser(null);
      setSessionExpiry("");
      message.error("登录已失效，请重新登录");
      return;
    }

    message.error(error instanceof Error ? error.message : fallback);
  }

  async function loadBootstrap() {
    setLoading(true);

    try {
      const [dashboardResponse, applicationsResponse, merchantsResponse] = await Promise.all([
        authedRequest<AdminDashboard>("/api/admin/dashboard"),
        authedRequest<{ items: MerchantApplication[] }>(
          `/api/admin/merchant-applications?status=${applicationFilter}`,
        ),
        authedRequest<{ items: Merchant[] }>("/api/admin/merchants"),
      ]);

      const merchantId =
        merchantsResponse.items.find((item) => item.id === selectedMerchantId)?.id ||
        merchantsResponse.items[0]?.id ||
        "";

      const bookingsResponse = await authedRequest<{ items: Booking[] }>(
        `/api/admin/bookings?status=${bookingFilter}${merchantId ? `&merchantId=${merchantId}` : ""}`,
      );

      setDashboard(dashboardResponse);
      setApplications(applicationsResponse.items);
      setMerchants(merchantsResponse.items);
      setSelectedMerchantId(merchantId);
      setBookings(bookingsResponse.items);
    } catch (error) {
      handleRequestError(error, "后台数据加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function submitLogin(values: { username: string; password: string }) {
    setLoginLoading(true);

    try {
      const response = await request<AdminAuthResponse>("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      localStorage.setItem(STORAGE_KEY, response.token);
      setAuthToken(response.token);
      setAdminUser(response.admin);
      setSessionExpiry(response.expiresAt);
      message.success("登录成功");
    } catch (error) {
      handleRequestError(error, "登录失败");
    } finally {
      setLoginLoading(false);
      setAuthLoading(false);
    }
  }

  async function logout() {
    try {
      await authedRequest("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      setAuthToken("");
      setAdminUser(null);
      setSessionExpiry("");
    }
  }

  async function reviewApplication(status: "approved" | "rejected") {
    if (!currentApplication) {
      return;
    }

    try {
      await authedRequest(`/api/admin/merchant-applications/${currentApplication.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewRemark }),
      });
      message.success(status === "approved" ? "申请已通过" : "申请已拒绝");
      setCurrentApplication(null);
      setReviewRemark("");
      await loadBootstrap();
    } catch (error) {
      handleRequestError(error, "审核失败");
    }
  }

  async function createRoom(values: RoomFormState) {
    if (!selectedMerchant) {
      message.warning("请先选择商家");
      return;
    }

    setSubmittingRoom(true);

    try {
      await authedRequest(`/api/admin/merchants/${selectedMerchant.id}/rooms`, {
        method: "POST",
        body: JSON.stringify({
          ...values,
          capacityMin: Number(values.capacityMin),
          capacityMax: Number(values.capacityMax),
          minSpend: Number(values.minSpend),
        }),
      });
      message.success("包间已创建");
      roomFormInstance.resetFields();
      setRoomForm(emptyRoomForm);
      await loadBootstrap();
    } catch (error) {
      handleRequestError(error, "创建包间失败");
    } finally {
      setSubmittingRoom(false);
    }
  }

  async function updateBookingStatus(id: string, status: "confirmed" | "rejected" | "completed") {
    try {
      await authedRequest(`/api/admin/bookings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      message.success("订单状态已更新");
      await loadBootstrap();
    } catch (error) {
      handleRequestError(error, "更新订单失败");
    }
  }

  const applicationColumns: ColumnsType<MerchantApplication> = [
    {
      title: "商家",
      dataIndex: "merchantName",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.merchantName}</Text>
          <Text type="secondary">{record.applicantName}</Text>
        </Space>
      ),
    },
    { title: "联系电话", dataIndex: "phone" },
    { title: "地址", dataIndex: "address" },
    { title: "营业时间", dataIndex: "businessHours" },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: MerchantApplicationStatus) => (
        <Tag color={getStatusTagColor(value)}>{getApplicationStatusLabel(value)}</Tag>
      ),
    },
    {
      title: "操作",
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            setCurrentApplication(record);
            setReviewRemark(record.reviewRemark || "");
          }}
        >
          查看并处理
        </Button>
      ),
    },
  ];

  const bookingColumns: ColumnsType<Booking> = [
    {
      title: "订单",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.contactName}</Text>
          <Text type="secondary">
            {record.diningDate} {record.diningTime}
          </Text>
        </Space>
      ),
    },
    { title: "商家", dataIndex: "merchantName" },
    { title: "包间", dataIndex: "roomName" },
    { title: "人数", dataIndex: "guestCount" },
    { title: "手机号", dataIndex: "contactPhone" },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: string, record) => <Tag color={getStatusTagColor(value)}>{record.statusLabel}</Tag>,
    },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          {record.status === "pending" ? (
            <>
              <Button size="small" onClick={() => void updateBookingStatus(record.id, "confirmed")}>
                确认
              </Button>
              <Button danger size="small" onClick={() => void updateBookingStatus(record.id, "rejected")}>
                拒绝
              </Button>
            </>
          ) : null}
          {record.status === "confirmed" ? (
            <Button type="primary" size="small" onClick={() => void updateBookingStatus(record.id, "completed")}>
              完成
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const roomColumns: ColumnsType<Merchant["rooms"][number]> = [
    { title: "包间", dataIndex: "name" },
    {
      title: "容纳人数",
      render: (_, record) => `${record.capacityMin}-${record.capacityMax} 位`,
    },
    {
      title: "最低消费",
      render: (_, record) => `¥${record.minSpend}`,
    },
    {
      title: "标签",
      render: (_, record) =>
        record.tags.length ? record.tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : <Text type="secondary">无</Text>,
    },
  ];

  function renderOverview() {
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Card>
              <Statistic title="活跃商家" value={dashboard.summary.activeMerchants} prefix={<ShopOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="包间总数" value={dashboard.summary.totalRooms} prefix={<ApartmentOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="待审核申请" value={dashboard.summary.pendingApplications} prefix={<AuditOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="待确认订单" value={pendingBookings.length} prefix={<CalendarOutlined />} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card title="最近入驻申请" extra={<Button type="link" onClick={() => setActiveView("applications")}>进入审核</Button>}>
              {latestApplications.length ? (
                <List
                  dataSource={latestApplications}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={item.merchantName}
                        description={`${item.applicantName} · ${item.createdAt}`}
                      />
                      <Tag color={getStatusTagColor(item.status)}>{getApplicationStatusLabel(item.status)}</Tag>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="最近订单" extra={<Button type="link" onClick={() => setActiveView("bookings")}>进入订单</Button>}>
              {latestBookings.length ? (
                <List
                  dataSource={latestBookings}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={`${item.contactName} · ${item.roomName}`}
                        description={`${item.merchantName} · ${item.diningDate} ${item.diningTime}`}
                      />
                      <Tag color={getStatusTagColor(item.status)}>{item.statusLabel}</Tag>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>
      </Space>
    );
  }

  function renderApplications() {
    return (
      <Card
        title="商家入驻审核"
        extra={
            <Segmented
              options={[...applicationFilterOptions]}
            value={applicationFilter}
            onChange={(value) => {
              setApplicationFilter(value as MerchantApplicationStatus | "all");
              void loadBootstrap();
            }}
          />
        }
      >
        <Table rowKey="id" columns={applicationColumns} dataSource={applications} pagination={{ pageSize: 8 }} />
      </Card>
    );
  }

  function renderMerchants() {
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card
          title="商家资产"
          extra={
            <Select
              value={selectedMerchant?.id}
              style={{ width: 260 }}
              options={merchants.map((merchant) => ({ label: merchant.name, value: merchant.id }))}
              onChange={setSelectedMerchantId}
            />
          }
        >
          {selectedMerchant ? (
            <Descriptions bordered column={2}>
              <Descriptions.Item label="商家名称">{selectedMerchant.name}</Descriptions.Item>
              <Descriptions.Item label="负责人">{selectedMerchant.ownerName}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{selectedMerchant.phone}</Descriptions.Item>
              <Descriptions.Item label="门店电话">{selectedMerchant.contactPhone}</Descriptions.Item>
              <Descriptions.Item label="城市">{selectedMerchant.city}</Descriptions.Item>
              <Descriptions.Item label="营业时间">{selectedMerchant.businessHours}</Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>
                {selectedMerchant.address}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        <Row gutter={[16, 16]}>
          <Col span={14}>
            <Card title="包间列表">
              <Table
                rowKey="id"
                columns={roomColumns}
                dataSource={selectedMerchant?.rooms || []}
                pagination={false}
                locale={{ emptyText: "当前商家暂无包间" }}
              />
            </Card>
          </Col>
          <Col span={10}>
            <Card title="新增包间">
              <Form
                layout="vertical"
                form={roomFormInstance}
                initialValues={roomForm}
                onValuesChange={(_, values) => setRoomForm(values as RoomFormState)}
                onFinish={(values) => void createRoom(values as RoomFormState)}
              >
                <Form.Item label="包间名称" name="name" rules={[{ required: true, message: "请输入包间名称" }]}>
                  <Input />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="最低人数" name="capacityMin" rules={[{ required: true, message: "请输入最低人数" }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="最高人数" name="capacityMax" rules={[{ required: true, message: "请输入最高人数" }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="最低消费" name="minSpend" rules={[{ required: true, message: "请输入最低消费" }]}>
                  <Input />
                </Form.Item>
                <Form.Item label="标签" name="tags">
                  <Input placeholder="逗号分隔，如 商务,临窗,投影" />
                </Form.Item>
                <Form.Item label="描述" name="description">
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={submittingRoom} block>
                  创建包间
                </Button>
              </Form>
            </Card>
          </Col>
        </Row>
      </Space>
    );
  }

  function renderBookings() {
    return (
      <Card
        title="订单流转"
        extra={
          <Space>
            <Segmented
              options={[...bookingFilterOptions]}
              value={bookingFilter}
              onChange={(value) => {
                setBookingFilter(value as BookingStatus | "all");
                void loadBootstrap();
              }}
            />
            <Select
              allowClear
              placeholder="筛选商家"
              value={selectedMerchantId || undefined}
              style={{ width: 220 }}
              options={merchants.map((merchant) => ({ label: merchant.name, value: merchant.id }))}
              onChange={(value) => {
                setSelectedMerchantId(value || "");
                void loadBootstrap();
              }}
            />
          </Space>
        }
      >
        <Table rowKey="id" columns={bookingColumns} dataSource={bookings} pagination={{ pageSize: 8 }} />
      </Card>
    );
  }

  if (authLoading) {
    return (
      <div className="admin-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className="login-page">
        <Row gutter={24} className="login-page__inner">
          <Col span={14}>
            <Card className="login-hero" bordered={false}>
              <Tag color="gold">宴请宾朋 Admin</Tag>
              <Title>餐厅包间预订运营管理台</Title>
              <Paragraph>
                基于 Ant Design 的后台管理界面，用来处理商家入驻审核、包间资产管理和订单流转。后端会切到 NestJS 模块化服务，便于后续做权限、日志、分页和更多业务模块。
              </Paragraph>
              <Space wrap size={[8, 8]}>
                <Tag color="blue">商家入驻</Tag>
                <Tag color="purple">包间资产</Tag>
                <Tag color="green">订单处理</Tag>
                <Tag color="cyan">角色扩展</Tag>
              </Space>
            </Card>
          </Col>
          <Col span={10}>
            <Card title="登录后台" className="login-card">
              <Form form={loginForm} layout="vertical" onFinish={(values) => void submitLogin(values)}>
                <Form.Item label="账号" name="username" rules={[{ required: true, message: "请输入账号" }]}>
                  <Input placeholder="请输入管理员账号" />
                </Form.Item>
                <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
                  <Input.Password placeholder="请输入密码" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={loginLoading} block>
                  登录
                </Button>
              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <>
      <Layout style={{ minHeight: "100vh" }}>
        <Sider width={240} theme="dark">
          <div className="brand-block">
            <Title level={4} style={{ color: "#fff", marginBottom: 4 }}>
              宴请宾朋
            </Title>
            <Text style={{ color: "rgba(255,255,255,0.65)" }}>Ant Design 管理台</Text>
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[activeView]}
            items={navItems}
            onClick={({ key }) => setActiveView(key as ViewKey)}
          />
        </Sider>
        <Layout>
          <Header className="admin-header">
            <Space direction="vertical" size={0}>
              <Title level={4} style={{ margin: 0 }}>
                {navItems.find((item) => item.key === activeView)?.label || "后台管理"}
              </Title>
              <Text type="secondary">NestJS + Ant Design 模块化后台</Text>
            </Space>
            <Space align="center">
              <Tag color="processing">{adminUser.displayName}</Tag>
              <Text type="secondary">{sessionExpiry ? `会话到期 ${new Date(sessionExpiry).toLocaleString()}` : ""}</Text>
              <Button icon={<LogoutOutlined />} onClick={() => void logout()}>
                退出
              </Button>
            </Space>
          </Header>
          <Content className="admin-content">
            <Spin spinning={loading}>
              {activeView === "overview" ? renderOverview() : null}
              {activeView === "applications" ? renderApplications() : null}
              {activeView === "merchants" ? renderMerchants() : null}
              {activeView === "bookings" ? renderBookings() : null}
            </Spin>
          </Content>
        </Layout>
      </Layout>

      <Modal
        title={currentApplication ? `审核：${currentApplication.merchantName}` : "审核申请"}
        open={Boolean(currentApplication)}
        onCancel={() => setCurrentApplication(null)}
        footer={[
          <Button key="reject" danger onClick={() => void reviewApplication("rejected")}>
            拒绝
          </Button>,
          <Button key="approve" type="primary" onClick={() => void reviewApplication("approved")}>
            审核通过
          </Button>,
        ]}
      >
        {currentApplication ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="申请人">{currentApplication.applicantName}</Descriptions.Item>
              <Descriptions.Item label="手机号">{currentApplication.phone}</Descriptions.Item>
              <Descriptions.Item label="门店电话">{currentApplication.contactPhone}</Descriptions.Item>
              <Descriptions.Item label="地址">{currentApplication.address}</Descriptions.Item>
              <Descriptions.Item label="营业时间">{currentApplication.businessHours}</Descriptions.Item>
            </Descriptions>
            <Input.TextArea
              rows={4}
              placeholder="填写审核意见"
              value={reviewRemark}
              onChange={(event) => setReviewRemark(event.target.value)}
            />
          </Space>
        ) : null}
      </Modal>
    </>
  );
}

export default function App() {
  return (
    <AntdApp>
      <AppInner />
    </AntdApp>
  );
}
