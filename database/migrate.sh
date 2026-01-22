#!/bin/bash
# 数据库迁移管理脚本
# Usage: ./migrate.sh [command] [options]

set -e

# 配置
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-voice_to_pay}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

MIGRATIONS_DIR="$(dirname "$0")/migrations"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 psql 是否安装
check_psql() {
    if ! command -v psql &> /dev/null; then
        log_error "psql 未安装，请先安装 PostgreSQL 客户端"
        exit 1
    fi
}

# 执行 SQL 命令
execute_sql() {
    local sql="$1"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql"
}

# 执行 SQL 文件
execute_sql_file() {
    local file="$1"
    log_info "执行迁移文件: $file"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file"
}

# 创建迁移版本表
create_migrations_table() {
    log_info "创建迁移版本表..."
    execute_sql "CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );"
}

# 获取当前数据库版本
get_current_version() {
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COALESCE(MAX(version), 0) FROM schema_migrations;" 2>/dev/null | xargs || echo "0"
}

# 应用所有待执行的迁移
migrate_up() {
    check_psql
    create_migrations_table
    
    local current_version=$(get_current_version)
    log_info "当前数据库版本: $current_version"
    
    local applied=0
    for migration_file in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$migration_file" ]; then
            local filename=$(basename "$migration_file")
            local version=$(echo "$filename" | grep -oP '^\d+')
            
            if [ "$version" -gt "$current_version" ]; then
                log_info "应用迁移 $version: $filename"
                execute_sql_file "$migration_file"
                applied=$((applied + 1))
            fi
        fi
    done
    
    if [ $applied -eq 0 ]; then
        log_info "没有待执行的迁移"
    else
        log_info "成功应用 $applied 个迁移"
    fi
}

# 显示迁移状态
migrate_status() {
    check_psql
    create_migrations_table
    
    log_info "迁移状态:"
    echo ""
    execute_sql "SELECT version, description, applied_at FROM schema_migrations ORDER BY version;"
    echo ""
    
    local current_version=$(get_current_version)
    log_info "当前版本: $current_version"
}

# 创建新的迁移文件
migrate_create() {
    local description="$1"
    if [ -z "$description" ]; then
        log_error "请提供迁移描述"
        echo "Usage: ./migrate.sh create <description>"
        exit 1
    fi
    
    # 获取下一个版本号
    local next_version=1
    if [ -d "$MIGRATIONS_DIR" ]; then
        local last_file=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort -V | tail -n 1)
        if [ -n "$last_file" ]; then
            local last_version=$(basename "$last_file" | grep -oP '^\d+')
            next_version=$((last_version + 1))
        fi
    else
        mkdir -p "$MIGRATIONS_DIR"
    fi
    
    # 格式化版本号（3位数字）
    local version_padded=$(printf "%03d" $next_version)
    local filename="${version_padded}_${description}.sql"
    local filepath="$MIGRATIONS_DIR/$filename"
    
    # 创建迁移文件模板
    cat > "$filepath" << EOF
-- Migration: ${version_padded}_${description}
-- Description: ${description}
-- Date: $(date +%Y-%m-%d)

-- ==================== UP Migration ====================

-- 在此处添加迁移 SQL 语句


-- ==================== 更新迁移版本 ====================

INSERT INTO schema_migrations (version, description) VALUES ($next_version, '${description}');
EOF
    
    log_info "创建迁移文件: $filepath"
}

# 显示帮助信息
show_help() {
    cat << EOF
数据库迁移管理脚本

Usage: ./migrate.sh [command] [options]

Commands:
    up          应用所有待执行的迁移
    status      显示迁移状态
    create      创建新的迁移文件
    help        显示帮助信息

Examples:
    ./migrate.sh up                          # 应用所有迁移
    ./migrate.sh status                      # 查看迁移状态
    ./migrate.sh create add_user_settings    # 创建新迁移

Environment Variables:
    DB_HOST      数据库主机 (默认: localhost)
    DB_PORT      数据库端口 (默认: 5432)
    DB_NAME      数据库名称 (默认: voice_to_pay)
    DB_USER      数据库用户 (默认: postgres)
    DB_PASSWORD  数据库密码 (默认: postgres)
EOF
}

# 主函数
main() {
    local command="${1:-help}"
    
    case "$command" in
        up)
            migrate_up
            ;;
        status)
            migrate_status
            ;;
        create)
            migrate_create "$2"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
