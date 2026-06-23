import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ResolveContextDto {
  @IsString()
  tenantId: string;

  @IsString()
  productId: string;

  @IsString()
  memberId: string;

  @IsOptional()
  @IsString()
  scene?: string;

  @IsOptional()
  @IsBoolean()
  isNewcomer?: boolean;

  @IsOptional()
  @IsString()
  memberLevel?: string;

  @IsOptional()
  @IsString()
  traceId?: string;
}

