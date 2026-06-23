import { IsNotEmpty, IsString } from 'class-validator';

/** 数据库连接（单一 connection URL） */
export class DatabaseConfig {
  @IsString()
  @IsNotEmpty()
  databaseUrl: string;
}
