CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    org_id UUID REFERENCES organizations(id),
    role TEXT NOT NULL DEFAULT 'viewer',
    name TEXT,
    invited_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE roles_permissions (
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    PRIMARY KEY (role, permission)
);

INSERT INTO roles_permissions (role, permission) VALUES
('admin', 'manage_org'),
('admin', 'manage_billing'),
('admin', 'manage_keys'),
('admin', 'manage_policies'),
('admin', 'view_usage'),
('admin', 'view_audit'),
('developer', 'manage_keys'),
('developer', 'view_usage'),
('viewer', 'view_usage');
