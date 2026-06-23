declare namespace App {
  namespace Service {
    type OtherBaseURLKey = App.I18n.Service.OtherBaseURLKey;

    interface ServiceConfigItem extends App.I18n.Service.ServiceConfigItem {}

    interface OtherServiceConfigItem extends App.I18n.Service.OtherServiceConfigItem {}

    interface ServiceConfig extends App.I18n.Service.ServiceConfig {}

    interface SimpleServiceConfig extends App.I18n.Service.SimpleServiceConfig {}

    type Response<T = unknown> = App.I18n.Service.Response<T>;

    type DemoResponse<T = unknown> = App.I18n.Service.DemoResponse<T>;
  }

  namespace I18n {
    interface $T {
      (key: string, ...args: unknown[]): string;
    }
  }
}

declare namespace Common {
  type PaginatingCommonParams = Api.Common.PaginatingCommonParams;
  type PaginatingQueryRecord<T = any> = Api.Common.PaginatingQueryRecord<T>;
  type CommonSearchParams = Api.Common.CommonSearchParams;
  type CommonRecord<T = any> = Api.Common.CommonRecord<T>;
  type CommonTreeRecord = Api.Common.CommonTreeRecord;
}
