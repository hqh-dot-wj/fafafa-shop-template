import { Controller, Post, Body, Get, Headers, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CheckLoginDto, ClientRegisterDto, BindPhoneDto } from './dto/auth.dto';
import { LoginOrRegisterBySmsDto, SendMemberLoginCodeDto } from './dto/sms-login.dto';
import { MemberPasswordLoginDto } from './dto/password-login.dto';
import { MemberResetPasswordDto, MemberSetPasswordDto, SendMemberResetCodeDto } from './dto/password-reset.dto';
import { MemberRefreshDto } from './dto/member-refresh.dto';
import { Api } from 'src/common/decorators/api.decorator';
import { LoginResultVo } from './vo';
import { User } from 'src/common/decorators/user.decorator';

@ApiTags('C端-认证模块')
@Controller('client/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Api({ summary: '静默登录检查', type: LoginResultVo })
  @Post('check-login')
  checkLogin(@Body() dto: CheckLoginDto) {
    return this.authService.checkLogin(dto);
  }

  @Api({ summary: '注册/登录（无需手机号）', type: LoginResultVo })
  @Post('register')
  register(@Body() dto: ClientRegisterDto) {
    return this.authService.register(dto);
  }

  @Api({ summary: '绑定手机号', security: true })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('member-jwt'))
  @Post('bind-phone')
  bindPhone(@User('memberId') memberId: string, @Body() dto: BindPhoneDto) {
    return this.authService.bindPhone(memberId, dto);
  }

  @Api({ summary: '手机号一键登录/注册', type: LoginResultVo })
  @Post('register-mobile')
  registerMobile(@Body() dto: ClientRegisterDto) {
    return this.authService.registerMobile(dto);
  }

  @Api({ summary: '发送登录短信验证码' })
  @Post('send-login-code')
  sendLoginCode(@Body() dto: SendMemberLoginCodeDto) {
    return this.authService.sendLoginCode(dto);
  }

  @Api({ summary: '短信验证码登录或自动注册', type: LoginResultVo })
  @Post('login-or-register-by-sms')
  loginOrRegisterBySms(@Body() dto: LoginOrRegisterBySmsDto) {
    return this.authService.loginOrRegisterBySms(dto);
  }

  @Api({ summary: '密码登录', type: LoginResultVo })
  @Post('password-login')
  passwordLogin(@Body() dto: MemberPasswordLoginDto) {
    return this.authService.passwordLogin(dto);
  }

  @Api({ summary: '发送重置密码短信验证码' })
  @Post('send-reset-code')
  sendResetCode(@Body() dto: SendMemberResetCodeDto) {
    return this.authService.sendResetCode(dto);
  }

  @Api({ summary: '重置密码（短信验证通过后）' })
  @Post('reset-password')
  resetPassword(@Body() dto: MemberResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Api({ summary: '设置/修改登录密码（需登录）', security: true })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('member-jwt'))
  @Post('set-password')
  setPassword(@User('memberId') memberId: string, @Body() dto: MemberSetPasswordDto) {
    return this.authService.setPassword(memberId, dto);
  }

  @Api({ summary: '刷新访问令牌', type: LoginResultVo })
  @Post('refresh')
  refresh(@Body() dto: MemberRefreshDto) {
    return this.authService.refreshMemberToken(dto);
  }

  @Api({ summary: '退出登录' })
  @Get('logout')
  logout(@Headers('authorization') token: string | undefined) {
    return this.authService.logout(token);
  }
}
