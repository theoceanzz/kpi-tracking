-- ====================================================
-- V3: Data Source (Lark-like) & Report/Chart Module
-- ====================================================

-- ====================================================
-- MODULE 1: DATA SOURCE (Excel-like sheets)
-- ====================================================

-- ====================================================
-- Data Sources — mỗi record = 1 bảng dữ liệu (sheet)
-- ====================================================
CREATE TABLE datasources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_id     UUID            NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    name            VARCHAR(255)    NOT NULL,
    description     TEXT,
    icon            VARCHAR(50),
    status          VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_by      UUID            NOT NULL REFERENCES users(id),
    updated_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_datasources_org_unit_id ON datasources(org_unit_id);
CREATE INDEX idx_datasources_status ON datasources(status);
CREATE INDEX idx_datasources_deleted_at ON datasources(deleted_at);
CREATE INDEX idx_datasources_created_by ON datasources(created_by);

-- ====================================================
-- Data Source Columns — định nghĩa schema cho mỗi cột
-- ====================================================
CREATE TABLE ds_columns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    datasource_id   UUID            NOT NULL REFERENCES datasources(id) ON DELETE CASCADE,
    name            VARCHAR(255)    NOT NULL,
    data_type       VARCHAR(30)     NOT NULL
                        CHECK (data_type IN (
                            'TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME',
                            'SELECT', 'MULTI_SELECT', 'URL', 'EMAIL',
                            'CURRENCY', 'PERCENT', 'ATTACHMENT', 'FORMULA',
                            'SELECT_ONE', 'SELECT_MULTI', 'USER'
                        )),
    column_order    INT             NOT NULL,
    is_required     BOOLEAN         NOT NULL DEFAULT FALSE,
    config          JSONB           NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_ds_columns_datasource_id ON ds_columns(datasource_id);
CREATE UNIQUE INDEX uq_ds_columns_order ON ds_columns(datasource_id, column_order);

-- ====================================================
-- Data Source Rows — hàng dữ liệu
-- ====================================================
CREATE TABLE ds_rows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    datasource_id   UUID            NOT NULL REFERENCES datasources(id) ON DELETE CASCADE,
    row_order       INT             NOT NULL,
    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_ds_rows_datasource_id ON ds_rows(datasource_id);
CREATE INDEX idx_ds_rows_order ON ds_rows(datasource_id, row_order);

-- ====================================================
-- Data Source Cells — ô dữ liệu (EAV pattern)
-- Mỗi cell lưu giá trị vào đúng typed column tương ứng
-- ====================================================
CREATE TABLE ds_cells (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    row_id          UUID            NOT NULL REFERENCES ds_rows(id) ON DELETE CASCADE,
    column_id       UUID            NOT NULL REFERENCES ds_columns(id) ON DELETE CASCADE,
    value_text      TEXT,
    value_number    DOUBLE PRECISION,
    value_boolean   BOOLEAN,
    value_date      TIMESTAMPTZ,
    value_json      JSONB
);

CREATE UNIQUE INDEX uq_ds_cells_row_column ON ds_cells(row_id, column_id);
CREATE INDEX idx_ds_cells_column_id ON ds_cells(column_id);
CREATE INDEX idx_ds_cells_value_number ON ds_cells(value_number) WHERE value_number IS NOT NULL;
CREATE INDEX idx_ds_cells_value_date ON ds_cells(value_date) WHERE value_date IS NOT NULL;

-- ====================================================
-- MODULE 2: REPORT & CHART WIDGETS
-- ====================================================

-- ====================================================
-- Reports — báo cáo thống kê
-- ====================================================
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_id     UUID            NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    name            VARCHAR(255)    NOT NULL,
    description     TEXT,
    status          VARCHAR(20)     NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    created_by      UUID            NOT NULL REFERENCES users(id),
    updated_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_reports_org_unit_id ON reports(org_unit_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_deleted_at ON reports(deleted_at);
CREATE INDEX idx_reports_created_by ON reports(created_by);

-- ====================================================
-- Report ↔ Data Source — liên kết N-N
-- Một report có thể dùng nhiều datasource
-- ====================================================
CREATE TABLE report_datasources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       UUID            NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    datasource_id   UUID            NOT NULL REFERENCES datasources(id) ON DELETE RESTRICT,
    alias           VARCHAR(100),
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_report_datasources ON report_datasources(report_id, datasource_id);
CREATE INDEX idx_report_datasources_ds ON report_datasources(datasource_id);

-- ====================================================
-- Report Widgets — biểu đồ / widget trong báo cáo
-- ====================================================
CREATE TABLE report_widgets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id               UUID            NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    report_datasource_id    UUID            REFERENCES report_datasources(id) ON DELETE CASCADE,
    widget_type             VARCHAR(30)     NOT NULL
                                CHECK (widget_type IN (
                                    'BAR', 'LINE', 'PIE', 'DONUT', 'AREA', 'SCATTER', 'TABLE', 'NUMBER_CARD', 'HEATMAP', 'TOP_STATS_GRID',
                                    'OVERVIEW_CARDS', 'TREND_CHART', 'TOP_UNITS', 'UNIT_PERFORMANCE', 'UNIT_KPI', 
                                    'MEMBER_DIST', 'ROLE_DIST', 'UNIT_RISK', 'WARNING_LIST', 'KPI_PODIUM', 'RANKING_TABLE'
                                )),
    title                   VARCHAR(255)    NOT NULL,
    description             TEXT,
    chart_config            JSONB           NOT NULL,
    position                JSONB           NOT NULL DEFAULT '{"x":0,"y":0,"w":6,"h":4}',
    widget_order            INT             NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ     DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_report_widgets_report_id ON report_widgets(report_id);
CREATE INDEX idx_report_widgets_rds_id ON report_widgets(report_datasource_id);
