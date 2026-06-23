import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    headerTitle?: string;
    hideChrome?: boolean;
    layout?: 'default' | 'blank';
    feature?: 'o2o' | 'distribution' | 'lbs' | 'wallet' | 'financeSettlement';
  }
}
