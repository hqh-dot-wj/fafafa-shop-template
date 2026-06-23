import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { NavigationService } from './navigation.service';

/**
 * 营销导航挂载接口，对应 admin-web service/api/marketing/scene-placement.ts 的导航树部分。
 * 该 Controller 只维护投放导航结构，场景定义和商品预览仍由 scene Controller 承接。
 */
@ApiTags('营销-导航挂载')
@ApiBearerAuth('Authorization')
@Controller('admin/navigation')
export class NavigationAdminController {
  constructor(private readonly service: NavigationService) {}

  @Get('tree')
  @Api({ summary: '导航树' })
  @RequirePermission('marketing:navigation:list')
  getTree(@Query('tenantId') tenantId?: string) {
    return this.service.getAdminTree(tenantId);
  }

  @Post('node')
  @Api({ summary: '创建导航节点' })
  @RequirePermission('marketing:navigation:create')
  createNode(
    @Body()
    body: {
      tenantId?: string;
      nodeType?: 'CATEGORY' | 'SCENE' | 'LINK';
      sceneCode?: string;
      sceneName?: string;
      categoryName?: string;
      parentNodeId?: string;
      sort?: number;
      sceneType?: string;
      pageRoute?: string;
      status?: string;
      channelScope?: string[];
    },
  ) {
    return this.service.createNode({
      tenantId: body.tenantId,
      nodeType: body.nodeType ?? 'SCENE',
      code: body.sceneCode,
      name: body.sceneName ?? body.categoryName,
      parentNodeId: body.parentNodeId,
      sort: body.sort,
      sceneType: body.sceneType,
      pagePath: body.pageRoute,
      status: body.status,
      channelScope: body.channelScope,
    });
  }

  @Put('node/:nodeId')
  @Api({ summary: '更新导航节点' })
  @RequirePermission('marketing:navigation:edit')
  updateNode(
    @Param('nodeId') nodeId: string,
    @Body()
    body: {
      tenantId?: string;
      nodeType?: 'CATEGORY' | 'SCENE' | 'LINK';
      sceneCode?: string;
      sceneName?: string;
      categoryName?: string;
      parentNodeId?: string;
      sort?: number;
      sceneType?: string;
      pageRoute?: string;
      status?: string;
      channelScope?: string[];
    },
  ) {
    return this.service.updateNode(nodeId, {
      tenantId: body.tenantId,
      nodeType: body.nodeType,
      code: body.sceneCode,
      name: body.sceneName ?? body.categoryName,
      parentNodeId: body.parentNodeId,
      sort: body.sort,
      sceneType: body.sceneType,
      pagePath: body.pageRoute,
      status: body.status,
      channelScope: body.channelScope,
    });
  }

  @Post('node/:nodeId/sort')
  @Api({ summary: '调整导航节点排序' })
  @RequirePermission('marketing:navigation:edit')
  sortNode(
    @Param('nodeId') nodeId: string,
    @Body() body?: { tenantId?: string; sort?: number; parentNodeId?: string },
  ) {
    return this.service.sortNode(nodeId, {
      tenantId: body?.tenantId,
      sort: body?.sort,
      parentNodeId: body?.parentNodeId,
    });
  }
}
