/**
 * 配置模块测试
 */

describe('Config Module', () => {
  beforeAll(() => {
    process.env.POSTGRES_PASSWORD = 'test-password';
    process.env.API_SECRET_KEY = 'test-secret';
  });

  it('should load configuration', () => {
    const { config } = require('../src/config');
    expect(config).toBeDefined();
    expect(config.postgresPassword).toBe('test-password');
  });

  it('should have default values', () => {
    const { config } = require('../src/config');
    expect(config.postgresHost).toBe('localhost');
    expect(config.postgresPort).toBe(5432);
  });
});
