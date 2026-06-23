import type { RouteRecordRaw } from 'vue-router';

const defaultLayout = () => import('@/layouts/default.vue');
const blankLayout = () => import('@/layouts/blank.vue');

/** 18 条业务路由；meta.headerTitle / hideChrome 对齐原 definePageMeta。 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: defaultLayout,
    children: [
      { path: '', name: 'home', component: () => import('@/views/home/index.vue'), meta: { headerTitle: '首页' } },
      {
        path: 'category',
        name: 'category',
        component: () => import('@/views/category/index.vue'),
        meta: { headerTitle: '分类' },
      },
      {
        path: 'cart',
        name: 'cart',
        component: () => import('@/views/cart/index.vue'),
        meta: { headerTitle: '购物车' },
      },
      {
        path: 'me',
        name: 'me',
        component: () => import('@/views/me/index.vue'),
        meta: { headerTitle: '我的' },
      },
      {
        path: 'product/:id',
        name: 'product-detail',
        component: () => import('@/views/product/detail.vue'),
        meta: { headerTitle: '商品详情' },
      },
      {
        path: 'order',
        name: 'order-list',
        component: () => import('@/views/order/index.vue'),
        meta: { headerTitle: '我的订单' },
      },
      {
        path: 'order/create',
        name: 'order-create',
        component: () => import('@/views/order/create.vue'),
        meta: { headerTitle: '确认订单' },
      },
      {
        path: 'order/:id',
        name: 'order-detail',
        component: () => import('@/views/order/detail.vue'),
        meta: { headerTitle: '订单详情' },
      },
      {
        path: 'address',
        name: 'address-list',
        component: () => import('@/views/address/index.vue'),
        meta: { headerTitle: '收货地址' },
      },
      {
        path: 'address/edit',
        name: 'address-edit',
        component: () => import('@/views/address/edit.vue'),
        meta: { headerTitle: '编辑地址' },
      },
      {
        path: 'coupon',
        name: 'coupon',
        component: () => import('@/views/coupon/index.vue'),
        meta: { headerTitle: '我的优惠券' },
      },
      {
        path: 'distribution',
        name: 'distribution',
        component: () => import('@/views/distribution/index.vue'),
        meta: { headerTitle: '分销中心', feature: 'distribution' },
      },
      {
        path: 'wallet',
        name: 'wallet',
        component: () => import('@/views/wallet/index.vue'),
        meta: { headerTitle: '我的钱包', feature: 'wallet' },
      },
      {
        path: 'service',
        name: 'service',
        component: () => import('@/views/service/index.vue'),
        meta: { headerTitle: '上门服务', feature: 'o2o' },
      },
      {
        path: 'stores',
        name: 'stores',
        component: () => import('@/views/stores/index.vue'),
        meta: { headerTitle: '附近门店', feature: 'lbs' },
      },
    ],
  },
  {
    path: '/',
    component: blankLayout,
    children: [
      {
        path: 'login',
        name: 'login',
        component: () => import('@/views/login/index.vue'),
        meta: { hideChrome: true, layout: 'blank' },
      },
      {
        path: 'pay/result',
        name: 'pay-result',
        component: () => import('@/views/pay/result.vue'),
        meta: { headerTitle: '支付结果', layout: 'blank' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];
