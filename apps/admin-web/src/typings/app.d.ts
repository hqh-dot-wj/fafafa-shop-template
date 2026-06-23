/** The global namespace for the app */
declare namespace App {
  /** Theme namespace */
  namespace Theme {
    type ColorPaletteNumber = import('@sa/color').ColorPaletteNumber;

    /** NaiveUI theme overrides that can be specified in preset */
    type NaiveUIThemeOverride = import('naive-ui').GlobalThemeOverrides;

    /** Theme setting */
    interface ThemeSetting {
      /** Theme scheme */
      themeScheme: UnionKey.ThemeScheme;
      /** grayscale mode */
      grayscale: boolean;
      /** colour weakness mode */
      colourWeakness: boolean;
      /** Whether to recommend color */
      recommendColor: boolean;
      /** Theme color */
      themeColor: string;
      /** Theme radius */
      themeRadius: number;
      /** Other color */
      otherColor: OtherColor;
      /** Whether info color is followed by the primary color */
      isInfoFollowPrimary: boolean;
      /** Reset cache strategy */
      resetCacheStrategy: UnionKey.ResetCacheStrategy;
      /** Layout */
      layout: {
        /** Layout mode */
        mode: UnionKey.ThemeLayoutMode;
        /** Scroll mode */
        scrollMode: UnionKey.ThemeScrollMode;
        /**
         * Whether to reverse the horizontal mix
         *
         * if true, the vertical child level menus in left and horizontal first level menus in top
         */
        reverseHorizontalMix: boolean;
      };
      /** Page */
      page: {
        /** Whether to show the page transition */
        animate: boolean;
        /** Page animate mode */
        animateMode: UnionKey.ThemePageAnimateMode;
      };
      /** Header */
      header: {
        /** Header height */
        height: number;
        /** Header breadcrumb */
        breadcrumb: {
          /** Whether to show the breadcrumb */
          visible: boolean;
          /** Whether to show the breadcrumb icon */
          showIcon: boolean;
        };
        /** Multilingual */
        multilingual: {
          /** Whether to show the multilingual */
          visible: boolean;
        };
        globalSearch: {
          /** Whether to show the GlobalSearch */
          visible: boolean;
        };
      };
      /** Tab */
      tab: {
        /** Whether to show the tab */
        visible: boolean;
        /**
         * Whether to cache the tab
         *
         * If cache, the tabs will get from the local storage when the page is refreshed
         */
        cache: boolean;
        /** Tab height */
        height: number;
        /** Tab mode */
        mode: UnionKey.ThemeTabMode;
        /** Whether to close tab by middle click */
        closeTabByMiddleClick: boolean;
      };
      /** Fixed header and tab */
      fixedHeaderAndTab: boolean;
      /** Sider */
      sider: {
        /** Inverted sider */
        inverted: boolean;
        /** Sider width */
        width: number;
        /** Collapsed sider width */
        collapsedWidth: number;
        /** Sider width when the layout is 'vertical-mix' or 'horizontal-mix' */
        mixWidth: number;
        /** Collapsed sider width when the layout is 'vertical-mix' or 'horizontal-mix' */
        mixCollapsedWidth: number;
        /** Child menu width when the layout is 'vertical-mix' or 'horizontal-mix' */
        mixChildMenuWidth: number;
      };
      /** Footer */
      footer: {
        /** Whether to show the footer */
        visible: boolean;
        /** Whether fixed the footer */
        fixed: boolean;
        /** Footer height */
        height: number;
        /** Whether float the footer to the right when the layout is 'horizontal-mix' */
        right: boolean;
      };
      /** Watermark */
      watermark: {
        /** Whether to show the watermark */
        visible: boolean;
        /** Watermark text */
        text: string;
        /** Whether to use user name as watermark text */
        enableUserName: boolean;
        /** Whether to use current time as watermark text */
        enableTime: boolean;
        /** Time format for watermark text */
        timeFormat: string;
      };
      /** Component size */
      componentSize: UnionKey.ThemeComponentSize;
      table: {
        /** Whether to show the table border */
        bordered: boolean;
        /** Whether to show the table bottom border */
        bottomBordered: boolean;
        /** Whether to show the table single column */
        singleColumn: boolean;
        /** Whether to show the table single line */
        singleLine: boolean;
        /** Whether to show the table size */
        size: UnionKey.ThemeTableSize;
        /** Whether to show the table striped */
        striped: boolean;
      };
      /** define some theme settings tokens, will transform to css variables */
      tokens: {
        light: ThemeSettingToken;
        dark?: {
          [K in keyof ThemeSettingToken]?: Partial<ThemeSettingToken[K]>;
        };
      };
    }

    interface OtherColor {
      info: string;
      success: string;
      warning: string;
      error: string;
    }

    interface ThemeColor extends OtherColor {
      primary: string;
    }

    type ThemeColorKey = keyof ThemeColor;

    type ThemePaletteColor = {
      [key in ThemeColorKey | `${ThemeColorKey}-${ColorPaletteNumber}`]: string;
    };

    type BaseToken = Record<string, Record<string, string>>;

    interface ThemeSettingTokenColor {
      /** the progress bar color, if not set, will use the primary color */
      nprogress?: string;
      container: string;
      layout: string;
      inverted: string;
      'base-text': string;
    }

    interface ThemeSettingTokenBoxShadow {
      header: string;
      sider: string;
      tab: string;
    }

    interface ThemeSettingToken {
      colors: ThemeSettingTokenColor;
      boxShadow: ThemeSettingTokenBoxShadow;
    }

    type ThemeTokenColor = ThemePaletteColor & ThemeSettingTokenColor;

    /** Theme token CSS variables */
    type ThemeTokenCSSVars = {
      colors: ThemeTokenColor & { [key: string]: string };
      boxShadow: ThemeSettingTokenBoxShadow & { [key: string]: string };
    };
  }

  /** Global namespace */
  namespace Global {
    type VNode = import('vue').VNode;
    type RouteLocationNormalizedLoaded = import('vue-router').RouteLocationNormalizedLoaded;
    type RouteKey = import('@elegant-router/types').RouteKey;
    type RouteMap = import('@elegant-router/types').RouteMap;
    type RoutePath = import('@elegant-router/types').RoutePath;
    type LastLevelRouteKey = import('@elegant-router/types').LastLevelRouteKey;

    /** The router push options */
    type RouterPushOptions = {
      query?: Record<string, string>;
      params?: Record<string, string>;
    };

    /** The global header props */
    interface HeaderProps {
      /** Whether to show the logo */
      showLogo?: boolean;
      /** Whether to show the menu toggler */
      showMenuToggler?: boolean;
      /** Whether to show the menu */
      showMenu?: boolean;
    }

    /** The global menu */
    type Menu = {
      /**
       * The menu key
       *
       * Equal to the route key
       */
      key: string;
      /** The menu label */
      label: string;
      /** The menu i18n key */
      i18nKey?: I18n.I18nKey | null;
      /** The route key */
      routeKey: RouteKey;
      /** The route path */
      routePath: RoutePath;
      /** The menu icon */
      icon?: () => VNode;
      /** The menu children */
      children?: Menu[];
    };

    type Breadcrumb = Omit<Menu, 'children'> & {
      options?: Breadcrumb[];
    };

    /** Tab route */
    type TabRoute = Pick<RouteLocationNormalizedLoaded, 'name' | 'path' | 'meta'> &
      Partial<Pick<RouteLocationNormalizedLoaded, 'fullPath' | 'query' | 'matched'>>;

    /** The global tab */
    type Tab = {
      /** The tab id */
      id: string;
      /** The tab label */
      label: string;
      /**
       * The new tab label
       *
       * If set, the tab label will be replaced by this value
       */
      newLabel?: string;
      /**
       * The old tab label
       *
       * when reset the tab label, the tab label will be replaced by this value
       */
      oldLabel?: string;
      /** The tab route key */
      routeKey: LastLevelRouteKey;
      /** The tab route path */
      routePath: RouteMap[LastLevelRouteKey];
      /** The tab route full path */
      fullPath: string;
      /** The tab fixed index */
      fixedIndex?: number | null;
      /**
       * Tab icon
       *
       * Iconify icon
       */
      icon?: string;
      /**
       * Tab local icon
       *
       * Local icon
       */
      localIcon?: string;
      /** I18n key */
      i18nKey?: I18n.I18nKey | null;
    };

    /** Form rule */
    type FormRule = import('naive-ui').FormItemRule;

    /** The global dropdown key */
    type DropdownKey = 'closeCurrent' | 'closeOther' | 'closeLeft' | 'closeRight' | 'closeAll';
  }

  /**
   * I18n namespace
   *
   * Locales type
   */
  namespace I18n {
    type RouteKey = import('@elegant-router/types').RouteKey;

    type LangType = 'en-US' | 'zh-CN';

    type LangOption = {
      label: string;
      key: LangType;
    };

    type I18nRouteKey = Exclude<RouteKey, 'root' | 'not-found'>;

    type FormMsg = {
      required: string;
      invalid: string;
      tooltip?: string;
      urlOptional?: string;
    };

    type OptionalUrlMsg = {
      urlOptional: string;
    };

    type Schema = {
      system: {
        title: string;
        updateTitle: string;
        updateContent: string;
        updateConfirm: string;
        updateCancel: string;
      };
      common: {
        action: string;
        add: string;
        addSuccess: string;
        backToHome: string;
        batchDelete: string;
        import: string;
        export: string;
        importSuccess: string;
        importFail: string;
        importTemplate: string;
        downloadTemplate: string;
        importResult: string;
        importEnd: string;
        importFormat: string;
        importSize: string;
        importTip: string;
        exportSuccess: string;
        exportFail: string;
        updateExisting: string;
        cancel: string;
        close: string;
        check: string;
        expandColumn: string;
        columnSetting: string;
        config: string;
        login: string;
        confirm: string;
        save: string;
        delete: string;
        deleteSuccess: string;
        confirmDelete: string;
        edit: string;
        download: string;
        warning: string;
        error: string;
        index: string;
        keywordSearch: string;
        logout: string;
        logoutConfirm: string;
        lookForward: string;
        modify: string;
        copySuccess: string;
        copyFailed: string;
        modifySuccess: string;
        noData: string;
        operate: string;
        pleaseCheckValue: string;
        refresh: string;
        reset: string;
        search: string;
        switch: string;
        tip: string;
        trigger: string;
        update: string;
        updateSuccess: string;
        saveSuccess: string;
        noChange: string;
        userCenter: string;
        name: string;
        sort: string;
        yesOrNo: {
          yes: string;
          no: string;
        };
        second: string;
        selected: string;
        anyRecords: string;
        clear: string;
        noSelectRecord: string;
      };
      request: {
        logout: string;
        logoutMsg: string;
        logoutWithModal: string;
        logoutWithModalMsg: string;
        refreshToken: string;
        tokenExpired: string;
      };
      theme: {
        themeDrawerTitle: string;
        tabs: {
          appearance: string;
          layout: string;
          general: string;
          component: string;
          preset: string;
        };
        appearance: {
          themeSchema: { title: string } & Record<UnionKey.ThemeScheme, string>;
          grayscale: string;
          colourWeakness: string;
          themeColor: {
            title: string;
            followPrimary: string;
          } & Record<Theme.ThemeColorKey, string>;
          recommendColor: string;
          recommendColorDesc: string;
          themeRadius: {
            title: string;
          };
          preset: {
            title: string;
            apply: string;
            applySuccess: string;
            [key: string]:
              | {
                  name: string;
                  desc: string;
                }
              | string;
          };
        };
        layout: {
          layoutMode: { title: string } & Record<UnionKey.ThemeLayoutMode, string> & {
              [K in `${UnionKey.ThemeLayoutMode}_detail`]: string;
            };
          tab: {
            title: string;
            visible: string;
            cache: string;
            cacheTip: string;
            height: string;
            mode: { title: string } & Record<UnionKey.ThemeTabMode, string>;
            closeByMiddleClick: string;
            closeByMiddleClickTip: string;
          };
          header: {
            title: string;
            height: string;
            breadcrumb: {
              visible: string;
              showIcon: string;
            };
          };
          sider: {
            title: string;
            inverted: string;
            width: string;
            collapsedWidth: string;
            mixWidth: string;
            mixCollapsedWidth: string;
            mixChildMenuWidth: string;
          };
          footer: {
            title: string;
            visible: string;
            fixed: string;
            height: string;
            right: string;
          };
          content: {
            title: string;
            scrollMode: { title: string; tip: string } & Record<UnionKey.ThemeScrollMode, string>;
            page: {
              animate: string;
              mode: { title: string } & Record<UnionKey.ThemePageAnimateMode, string>;
            };
            fixedHeaderAndTab: string;
          };
        };
        general: {
          title: string;
          watermark: {
            title: string;
            visible: string;
            text: string;
            enableUserName: string;
            enableTime: string;
            timeFormat: string;
          };
          multilingual: {
            title: string;
            visible: string;
          };
          globalSearch: {
            title: string;
            visible: string;
          };
        };
        configOperation: {
          copyConfig: string;
          copySuccessMsg: string;
          resetConfig: string;
          resetSuccessMsg: string;
        };
        // RuoYi custom: component settings
        componentPropsTitle: string;
        component: {
          size: { title: string; tiny: string; small: string; medium: string; large: string };
        };
        // RuoYi custom: table settings
        tablePropsTitle: string;
        table: {
          size: { title: string } & Record<UnionKey.ThemeTableSize, string>;
          bordered: string;
          bottomBordered: string;
          singleColumn: string;
          singleLine: string;
          striped: string;
        };
      };
      route: Record<string, string>;
      menu: Record<string, string>;
      dict: Record<string, Record<string, string>>;

      page: {
        common: {
          id: string;
          createBy: string;
          createTime: string;
          updateBy: string;
          updateTime: string;
          remark: string;
          form: {
            remark: FormMsg;
          };
        };
        login: {
          common: {
            title: string;
            subTitle: string;
            loginOrRegister: string;
            register: string;
            userNamePlaceholder: string;
            phonePlaceholder: string;
            codePlaceholder: string;
            passwordPlaceholder: string;
            confirmPasswordPlaceholder: string;
            codeLogin: string;
            confirm: string;
            back: string;
            validateSuccess: string;
            loginSuccess: string;
            welcomeBack: string;
          };
          pwdLogin: {
            title: string;
            rememberMe: string;
            forgetPassword: string;
            register: string;
            otherAccountLogin: string;
            otherLoginMode: string;
            superAdmin: string;
            admin: string;
            user: string;
          };
          codeLogin: {
            title: string;
            getCode: string;
            reGetCode: string;
            sendCodeSuccess: string;
            imageCodePlaceholder: string;
          };
          register: {
            title: string;
            agreement: string;
            protocol: string;
            policy: string;
          };
          resetPwd: {
            title: string;
          };
          bindWeChat: {
            title: string;
          };
        };
        home: {
          branchDesc: string;
          greeting: string;
          weatherDesc: string;
          projectCount: string;
          todo: string;
          message: string;
          downloadCount: string;
          registerCount: string;
          schedule: string;
          study: string;
          work: string;
          rest: string;
          entertainment: string;
          visitCount: string;
          turnover: string;
          dealCount: string;
          walletBalance: string;
          todayGMV: string;
          todayOrderCount: string;
          monthGMV: string;
          productCount: string;
          memberCount: string;
          settledCommission: string;
          pendingCommission: string;
          projectNews: {
            title: string;
            moreNews: string;
            desc1: string;
            desc2: string;
            desc3: string;
            desc4: string;
            desc5: string;
          };
          creativity: string;
        };
        system: {
          client: {
            title: string;
            clientId: string;
            clientKey: string;
            clientSecret: string;
            grantTypeList: string;
            deviceType: string;
            activeTimeout: string;
            timeout: string;
            status: string;
            form: {
              clientId: FormMsg;
              clientKey: FormMsg;
              clientSecret: FormMsg;
              grantTypeList: FormMsg;
              deviceType: FormMsg;
              activeTimeout: FormMsg;
              timeout: FormMsg;
              status: FormMsg;
            };
            addClient: string;
            editClient: string;
          };
          config: {
            title: string;
            configName: string;
            configKey: string;
            configValue: string;
            configType: string;
            remark: string;
            createTime: string;
            refreshCache: string;
            refreshCacheSuccess: string;
            form: {
              configId: FormMsg;
              configName: FormMsg;
              configKey: FormMsg;
              configValue: FormMsg;
              configType: FormMsg;
              remark: FormMsg;
            };
            addConfig: string;
            editConfig: string;
          };
          dept: {
            empty: string;
            title: string;
            parentId: string;
            deptName: string;
            orderNum: string;
            deptCategory: string;
            leader: string;
            phone: string;
            email: string;
            status: string;
            sort: string;
            createTime: string;
            expandAll: string;
            collapseAll: string;
            form: {
              parentId: FormMsg;
              deptName: FormMsg;
              orderNum: FormMsg;
              deptCategory: FormMsg;
              leader: FormMsg;
              phone: FormMsg;
              email: FormMsg;
              status: FormMsg;
              sort: FormMsg;
              deptId: FormMsg;
            };
            error: {
              getDeptDataFail: string;
              getDeptUserDataFail: string;
            };
            placeholder: {
              defaultLeaderPlaceHolder: string;
              addDataLeaderPlaceHolder: string;
              deptUserIsEmptyLeaderPlaceHolder: string;
            };
            addDept: string;
            editDept: string;
          };
          dict: {
            title: string;
            dictTypeTitle: string;
            dictName: string;
            dictType: string;
            status: string;
            remark: string;
            createTime: string;
            refreshCacheSuccess: string;
            refreshCache: string;
            confirmDeleteDictType: string;
            data: {
              title: string;
              label: string;
              value: string;
              dictSort: string;
              isDefault: string;
              listClass: string;
              cssClass: string;
              status: string;
              remark: string;
              createTime: string;
            };
            form: {
              dictId: FormMsg;
              dictCode: FormMsg;
              dictName: FormMsg;
              dictType: FormMsg;
              status: FormMsg;
              remark: FormMsg;
              dictLabel: FormMsg;
              dictValue: FormMsg;
              dictSort: FormMsg;
              isDefault: FormMsg;
              listClass: FormMsg;
              cssClass: FormMsg;
            };
            addDict: string;
            editDict: string;
            addDictData: string;
            editDictData: string;
            addDictType: string;
            editDictType: string;
            exportDictType: string;
            refreshDictType: string;
            dictTypeIsEmpty: string;
          };
          menu: {
            title: string;
            parentId: string;
            iconType: string;
            menuName: string;
            icon: string;
            orderNum: string;
            perms: string;
            component: string;
            path: string;
            externalPath: string;
            query: string;
            iframeQuery: string;
            isFrame: string;
            isCache: string;
            menuType: string;
            visible: string;
            status: string;
            createTime: string;
            cache: string;
            noCache: string;
            rootName: string;
            buttonPermissionList: string;
            emptyMenu: string;
            menuDetail: string;
            cascadeDeleteContent: string;
            iconifyTip: string;
            isFrameTip: string;
            isCacheTip: string;
            visibleTip: string;
            statusTip: string;
            permsTip: string;
            componentTip: string;
            pathTip: string;
            form: {
              parentId: FormMsg;
              menuType: FormMsg;
              menuIds: FormMsg;
              icon: FormMsg;
              menuName: FormMsg;
              orderNum: FormMsg;
              perms: FormMsg;
              isFrame: FormMsg;
              path: FormMsg;
              component: FormMsg;
              query: FormMsg;
              isCache: FormMsg;
              visible: FormMsg;
              status: FormMsg;
              permission: FormMsg;
            };
            placeholder: {
              iconifyIconPlaceholder: string;
              localIconPlaceholder: string;
              queryKey: string;
              queryValue: string;
              queryIframe: string;
            };
            directory: string;
            menu: string;
            button: string;
            addMenu: string;
            addChildMenu: string;
            editMenu: string;
            cascadeDelete: string;
          };
          notice: {
            title: string;
            noticeTitle: string;
            noticeType: string;
            noticeContent: string;
            status: string;
            createTime: string;
            form: {
              noticeTitle: FormMsg;
              noticeType: FormMsg;
              noticeContent: FormMsg;
              status: FormMsg;
            };
            addNotice: string;
            editNotice: string;
          };
          oss: {
            title: string;
            fileName: string;
            originalName: string;
            fileSuffix: string;
            url: string;
            createTime: string;
            service: string;
            form: {
              file: FormMsg;
            };
            upload: string;
            preview: string;
            download: string;
            copy: string;
            copySuccess: string;
          };
          ossConfig: {
            title: string;
            configKey: string;
            accessKey: string;
            secretKey: string;
            bucketName: string;
            prefix: string;
            endpoint: string;
            domain: string;
            isHttps: string;
            region: string;
            status: string;
            remark: string;
            createTime: string;
            form: {
              configKey: FormMsg;
              accessKey: FormMsg;
              secretKey: FormMsg;
              bucketName: FormMsg;
              prefix: FormMsg;
              endpoint: FormMsg;
              domain: FormMsg;
              isHttps: FormMsg;
              region: FormMsg;
              status: FormMsg;
              remark: FormMsg;
            };
            addOssConfig: string;
            editOssConfig: string;
          };
          post: {
            title: string;
            postCode: string;
            postName: string;
            postSort: string;
            status: string;
            remark: string;
            createTime: string;
            form: {
              postCode: FormMsg;
              postName: FormMsg;
              postSort: FormMsg;
              status: FormMsg;
              remark: FormMsg;
            };
            addPost: string;
            editPost: string;
          };
          role: {
            title: string;
            roleName: string;
            roleKey: string;
            roleSort: string;
            status: string;
            remark: string;
            menuPermission: string;
            dataScope: string;
            createTime: string;
            form: {
              roleName: FormMsg;
              roleKey: FormMsg;
              roleSort: FormMsg;
              status: FormMsg;
              remark: FormMsg;
              menuIds: FormMsg;
              deptIds: FormMsg;
            };
            addRole: string;
            editRole: string;
            configPermission: string;
            authorizedUsers: string;
            selectMenuPermission: string;
            selectDataScope: string;
            selectDeptPermission: string;
          };
          tenant: {
            title: string;
            tenantName: string;
            tenantId: string;
            contactUserName: string;
            contactPhone: string;
            companyName: string;
            licenseNumber: string;
            address: string;
            intro: string;
            domain: string;
            packageId: string;
            expireTime: string;
            accountCount: string;
            status: string;
            createTime: string;
            form: {
              tenantName: FormMsg;
              contactUserName: FormMsg;
              contactPhone: FormMsg;
              companyName: FormMsg;
              licenseNumber: FormMsg;
              address: FormMsg;
              intro: FormMsg;
              domain: FormMsg;
              packageId: FormMsg;
              expireTime: FormMsg;
              accountCount: FormMsg;
              status: FormMsg;
            };
            addTenant: string;
            editTenant: string;
          };
          tenantPackage: {
            title: string;
            packageName: string;
            menuIds: string;
            remark: string;
            status: string;
            createTime: string;
            form: {
              packageName: FormMsg;
              menuIds: FormMsg;
              status: FormMsg;
              remark: FormMsg;
            };
            addTenantPackage: string;
            editTenantPackage: string;
            statusChangeSuccess: string;
          };
          user: {
            title: string;
            userName: string;
            nickName: string;
            deptName: string;
            phonenumber: string;
            status: string;
            createTime: string;
            password: string;
            confirmPassword: string;
            sex: string;
            roleIds: string;
            postIds: string;
            email: string;
            avatar: string;
            remark: string;
            form: {
              userName: FormMsg;
              nickName: FormMsg;
              deptId: FormMsg;
              phonenumber: FormMsg;
              status: FormMsg;
              password: FormMsg;
              confirmPassword: FormMsg;
              sex: FormMsg;
              roleIds: FormMsg;
              postIds: FormMsg;
              email: FormMsg;
              remark: FormMsg;
            };
            addUser: string;
            editUser: string;
            resetPassword: string;
            importUsers: string;
            exportTemplate: string;
            importSuccess: string;
            statusChangeSuccess: string;
          };
          fileManager: {
            title: string;
            uploadSuccess: string;
            uploadPartialSuccess: string;
            uploadFailed: string;
            selectFilesFirst: string;
            deleteSuccess: string;
            deleteFailed: string;
            renameSuccess: string;
            moveSuccess: string;
            moveFailed: string;
            loadFoldersFailed: string;
            selectTargetFolder: string;
            shareSuccess: string;
            createShareSuccess: string;
            batchShareSuccess: string;
            batchSharePartialFailed: string;
            batchShareFailed: string;
            downloadStarted: string;
            getDownloadLinkFailed: string;
            copySuccess: string;
            copyFailed: string;
            refreshSuccess: string;
            getVersionsFailed: string;
            restoreVersion: string;
            restoreVersionConfirm: string;
            restoreVersionSuccess: string;
            restoreVersionFailed: string;
            fileModified: string;
            getRecycleListFailed: string;
            restoreFile: string;
            restoreFileConfirm: string;
            restoreFileSuccess: string;
            restoreFileFailed: string;
            selectFilesToRestore: string;
            permanentDelete: string;
            permanentDeleteConfirm: string;
            selectFilesToDelete: string;
          };
        };
        worker: {
          notice: string;
          factTitle: string;
          boundaryTitle: string;
          column: {
            fact: string;
            owner: string;
            source: string;
            status: string;
            action: string;
            writeOwner: string;
            externalRule: string;
          };
          fact: {
            profile: string;
            audit: string;
            schedule: string;
            dispatch: string;
            settlement: string;
          };
          owner: {
            worker: string;
            workerResource: string;
            fulfillment: string;
            order: string;
            finance: string;
          };
          source: {
            schema: string;
            fulfillment: string;
            none: string;
          };
          status: {
            planning: string;
            available: string;
            notStarted: string;
          };
          boundary: {
            audit: string;
            dispatch: string;
            order: string;
            finance: string;
          };
          external: {
            readOnly: string;
            viaFulfillment: string;
            aggregateOnly: string;
            viaFinance: string;
          };
        };
        member: {
          title: string;
          userInfo: string;
          tenant: string;
          referrer: string;
          indirectReferrer: string;
          status: string;
          registerTime: string;
          level: string;
          editLevel: string;
          editReferrer: string;
          editTenant: string;
          form: {
            referrerId: string;
            tenantId: string;
            levelId: string;
          };
          detailDrawer: {
            title: string;
            tabInfo: string;
            tabOrder: string;
            tabFinance: string;
            tabPoints: string;
            tabOperationLog: string;
            cardTotalConsumption: string;
            cardCommission: string;
            cardBalance: string;
            cardPoints: string;
            btnAdjustPoints: string;
            descTitle: string;
            labelMemberId: string;
            labelRegisterTime: string;
            labelTenant: string;
            labelReferrer: string;
            labelReferrerMobile: string;
            orderColOrderSn: string;
            orderColPayAmount: string;
            orderColStatus: string;
            orderColCreateTime: string;
            financeColType: string;
            financeColAmount: string;
            financeColTime: string;
            financeTypeOrderIncome: string;
            financeTypeCommissionIn: string;
            financeTypeOther: string;
            pointColType: string;
            pointColChange: string;
            pointColAfter: string;
            pointColTime: string;
            operationColTime: string;
            operationColAction: string;
            operationColOperator: string;
            operationColDetail: string;
            operationDetailDash: string;
            actionOrderReassignWorker: string;
            actionOrderVerify: string;
            actionOrderRefund: string;
            actionOrderPartialRefund: string;
            actionOrderProductShip: string;
            actionOrderProductReceive: string;
            actionOrderBatchVerify: string;
            actionOrderBatchRefund: string;
            actionOrderBatchRemark: string;
            actionOrderBatchStatusTransition: string;
            actionMemberLevelUpdate: string;
            actionMemberManualLevel: string;
            actionMemberPointAdjust: string;
            actionMemberUpgradeApprove: string;
            actionMemberUpgradeReject: string;
          };
          pointAdjust: {
            drawerTitle: string;
            typeLabel: string;
            typeAdd: string;
            typeSub: string;
            amountLabel: string;
            remarkLabel: string;
            remarkPlaceholder: string;
            msgSuccess: string;
            btnCancel: string;
            btnSubmit: string;
          };
          search: {
            nicknameLabel: string;
            nicknamePlaceholder: string;
            mobileLabel: string;
            mobilePlaceholder: string;
            levelPlaceholder: string;
            startDatePlaceholder: string;
            endDatePlaceholder: string;
            shortcut7d: string;
            shortcut30d: string;
            shortcutMonth: string;
          };
          levelOptionMember: string;
          levelOptionCaptain: string;
          levelOptionShareholder: string;
          confirm: {
            updateStatus: string;
            statusUpdated: string;
            updateSuccess: string;
          };
        };
        storeDistributionActivity: {
          migrateAlertTitle: string;
          migrateAlertDesc: string;
          goMarketingConfig: string;
          unifyEntry: string;
          table: {
            ruleName: string;
            relatedProduct: string;
            onShelf: string;
            offShelf: string;
            activityConfig: string;
            price: string;
            startShort: string;
            endShort: string;
            status: string;
            commissionMode: string;
            commissionRate: string;
            aggregateEnabled: string;
            zoneEnabled: string;
            displayPriority: string;
            shelve: string;
            unshelve: string;
            configTooltip: string;
            deleteConfirm: string;
            shelfSuccess: string;
            unshelfSuccess: string;
          };
          configDrawer: {
            title: string;
            stepPickTemplate: string;
            templateLabel: string;
            templatePlaceholder: string;
            stepPickProduct: string;
            serviceType: string;
            serviceTypeService: string;
            serviceTypeReal: string;
            skuPick: string;
            serviceIdPlaceholder: string;
            pickProduct: string;
            skuParticipate: string;
            skuParticipateHint: string;
            stepRules: string;
            pickLocation: string;
            pickLocationBtn: string;
            previewCard: string;
            previewProduct: string;
            cancel: string;
            confirmProduce: string;
            mapModalTitle: string;
            mapConfirm: string;
            msgPickLocation: string;
            msgCreateSuccess: string;
            msgUpdateSuccess: string;
            defaultSpecLabel: string;
            productNameFallback: string;
          };
        };
        finance_distribution_config: {
          title: string;
          level1Rate: string;
          level2Rate: string;
          enableLV0: string;
          commissionBaseType: string;
          commissionBasePlaceholder: string;
          commissionBase: {
            ORIGINAL_PRICE: string;
            ACTUAL_PAID: string;
            ZERO: string;
          };
          maxCommissionRate: string;
          maxCommissionRateTip: string;
          commissionTip: string;
        };
        pms: {
          brand: {
            title: string;
            brandName: string;
            brandLogo: string;
            addBrand: string;
            editBrand: string;
            searchBrandName: string;
            form: {
              brandName: FormMsg;
              logo: FormMsg;
            };
          };
          category: {
            title: string;
            categoryName: string;
            icon: string;
            categoryDetail: string;
            subCategoryList: string;
            addCategory: string;
            editCategory: string;
            addSubCategory: string;
            parentCategory: string;
            selectParent: string;
            bindType: string;
            realProduct: string;
            serviceProduct: string;
            attributeTemplate: string;
            selectAttributeTemplate: string;
            form: {
              categoryName: FormMsg;
              sort: FormMsg;
              icon: OptionalUrlMsg;
            };
          };
          attribute: {
            attributeCount: string;
            title: string;
            addTemplate: string;
            editTemplate: string;
            attributeConfig: string;
            addAttribute: string;
            attributeName: string;
            usageType: string;
            inputType: string;
            inputList: string;
            applyType: string;
            noAttributes: string;
            validate: {
              attributeNameRequired: string;
            };
            usage: {
              param: string;
              spec: string;
            };
            input: {
              manual: string;
              select: string;
            };
            apply: {
              common: string;
              real: string;
              service: string;
            };
            placeholder: {
              attributeName: string;
              inputList: string;
            };
          };
          product: {
            title: string;
            add: string;
            edit: string;
            name: string;
          };
          globalProductCreate: {
            step3: {
              cardTitle: string;
              detailList: string;
              emptyHint: string;
              prev: string;
              next: string;
              batchGuidePrice: string;
              applyGuidePrice: string;
              batchCostPrice: string;
              applyCostPrice: string;
              batchCostRate: string;
              applyCostByRate: string;
              batchGuideRate: string;
              applyGuideRate: string;
              batchMin: string;
              applyMin: string;
              batchMax: string;
              applyMax: string;
              prefixGuide: string;
              prefixCost: string;
              prefixCostPct: string;
              prefixGuideRate: string;
              prefixMin: string;
              prefixMax: string;
              colGuidePrice: string;
              colCostPrice: string;
              colStock: string;
              colSkuCode: string;
              colDistMode: string;
              colMinDist: string;
              colGuideRate: string;
              colMaxDist: string;
              phMin: string;
              phGuide: string;
              phMax: string;
              suffixYuan: string;
              suffixPercent: string;
              distNone: string;
              distRatio: string;
              distFixed: string;
              msgBatchGuidePrice: string;
              msgBatchGuideRate: string;
              msgBatchCostByRate: string;
              msgBatchCostPrice: string;
              msgBatchMin: string;
              msgBatchMax: string;
              msgGuideLow: string;
              msgGuideHigh: string;
            };
            step4: {
              cardTitle: string;
              selectPlaceholder: string;
              inputPlaceholder: string;
              emptyParams: string;
              prev: string;
              submit: string;
            };
          };
        };
        pms_category: {
          title: string;
        };
        pms_brand: {
          title: string;
        };
        'pms_global-product': {
          title: string;
        };
        pms_attribute: {
          title: string;
        };
        store_product_market: {
          title?: string;
          importDialog: {
            modalTitle: string;
            typeLabel: string;
            typeReal: string;
            typeService: string;
            serviceRadiusLabel: string;
            serviceRadiusPlaceholder: string;
            suffixMeter: string;
            feedbackRadius: string;
            radiusNotSet: string;
            specConfigTitle: string;
            stockHintReal: string;
            stockHintService: string;
            colSpec: string;
            defaultSpec: string;
            colCost: string;
            colPrice: string;
            colStock: string;
            colDistMode: string;
            colDistRate: string;
            colProfit: string;
            msgLoss: string;
            msgSuccess: string;
            confirmImport: string;
          };
          card: {
            defaultSpecLabel: string;
            noDescription: string;
            guidePrice: string;
            imported: string;
            importNow: string;
            typeReal: string;
            typeService: string;
          };
          index: {
            categoryCardTitle: string;
            searchCategoryPlaceholder: string;
            emptyTree: string;
            tabAll: string;
            tabReal: string;
            tabService: string;
            downloadTemplate: string;
            batchExcel: string;
            templateVersionPlaceholder: string;
            templateLatestBadge: string;
            templateDefaultLatest: string;
            batchImport: string;
            searchNamePlaceholder: string;
            search: string;
            emptyProducts: string;
            msgSelectCategoryForTemplate: string;
            msgSelectProducts: string;
            msgNoSkus: string;
            batchImportDone: string;
            batchResultTitle: string;
            batchResultIdColumn: string;
            rootCategoryName: string;
            importRowId: string;
            downloadFilename: string;
          };
        };
        store_product_list: {
          title: string;
        };
        store_product_draft: {
          title?: string;
          columnProductInfo: string;
          originalTitlePrefix: string;
          columnAuditStatus: string;
          auditDraft: string;
          auditRejected: string;
          columnRejectReason: string;
          columnSubmittedAt: string;
          dash: string;
          continueEdit: string;
          submitAudit: string;
          removeDraft: string;
          popSubmitAudit: string;
          popRemoveDraft: string;
          msgSubmitQueued: string;
          msgSelectDrafts: string;
          msgBatchSubmitDone: string;
          msgRemoved: string;
          tabDraft: string;
          tabRejected: string;
          batchSubmitAudit: string;
        };
        store_product_review?: {
          title: string;
        };
        store_stock: {
          title?: string;
          cardTitle: string;
          columnProduct: string;
          columnSpecs: string;
          columnStock: string;
          columnQuickAdjust: string;
          btnAdd: string;
          btnReduce: string;
          popoverQtyLabelAdd: string;
          popoverQtyLabelReduce: string;
          popoverReasonLabel: string;
          popoverReasonPh: string;
          msgUpdated: string;
          msgSelectSku: string;
          searchPlaceholder: string;
          search: string;
          reset: string;
          batchAdjust: string;
          export: string;
          exportFilename: string;
          batch: {
            title: string;
            hint: string;
            thProduct: string;
            thSpec: string;
            thCurrent: string;
            thChange: string;
            thReason: string;
            changePlaceholder: string;
            reasonOptional: string;
            msgNeedChange: string;
            msgDone: string;
            resultTitle: string;
            resultIdColumn: string;
          };
        };

        store_distribution: {
          title: string;
          level1Rate: string;
          level2Rate: string;
          enableLV0: string;
          lv0Policy: string;
          lv0PolicyDesc: string;
          lv1PolicyDesc: string;
          historyTitle: string;
          graphTitle: string;
          crossTenantSettings: string;
          enableCrossTenant: string;
          enableCrossTenantDesc: string;
          crossTenantRate: string;
          crossTenantRateTip: string;
          crossMaxDaily: string;
          crossMaxDailyTip: string;
          couponUsageSearch: {
            memberId: string;
            templateId: string;
            usedTime: string;
            memberIdPlaceholder: string;
            templateIdPlaceholder: string;
            startTime: string;
            endTime: string;
          };
          productSearch: {
            productId: string;
            categoryId: string;
            productIdPlaceholder: string;
            categoryIdPlaceholder: string;
            isActive: string;
            isActiveAll: string;
          };
          search: {
            status: string;
            statusPlaceholder: string;
            enabled: string;
            disabled: string;
          };
          commissionTrend: {
            title: string;
            seriesName: string;
          };
          commissionBaseType: string;
          commissionBasePlaceholder: string;
          commissionFuse: string;
          commissionFuseTip: string;
          graphCommissionBase: string;
          graphC1: string;
          graphC2: string;
          graphFootnote: string;
          sharePolicy: {
            summaryTitle: string;
            status: string;
            minuteUnit: string;
            linkExpireMinutes: string;
            maxClickCount: string;
            maxBindCount: string;
            maxOrderCount: string;
            bindingMode: string;
            bindingModePlaceholder: string;
            bindingModeRecommendCode: string;
            bindingModeRelation: string;
            bindingModeBoth: string;
            attributionMode: string;
            attributionModePlaceholder: string;
            attributionModeFirstTouch: string;
            attributionModeLastTouch: string;
            attributionModeFirstBindLock: string;
            attributionWindowMinutes: string;
            enableCrossTenantBind: string;
          };
          shareTools: {
            generateToken: string;
            tokenResultTitle: string;
            tokenEmptyTip: string;
            logTitle: string;
            logHint: string;
            sid: string;
            sidPlaceholder: string;
            bizType: string;
            bizId: string;
            bizIdPlaceholder: string;
            bizIdPlaceholderProduct: string;
            bizIdPlaceholderActivity: string;
            bizIdPlaceholderPage: string;
            expireAt: string;
            status: string;
            shareUserId: string;
            shareUserIdPlaceholder: string;
            maxClickCount: string;
            maxBindCount: string;
            maxOrderCount: string;
            linkExpireMinutes: string;
            reason: string;
            eventType: string;
            eventTypePlaceholder: string;
            eventTypeClick: string;
            eventTypeBind: string;
            eventTypeOrderAttributed: string;
            eventTypeExpiredHit: string;
            eventTypeLimitHit: string;
            eventTypeInvalidHit: string;
            eventTypeManualDisable: string;
            bizTypeProduct: string;
            bizTypeActivity: string;
            bizTypePage: string;
            generateQrcode: string;
            generateQrcodeSuccess: string;
            shareUserIdRequired: string;
            bizIdRequired: string;
            sidRequired: string;
          };
        };
        store_commission_audit: {
          cardSearchTitle: string;
          cardRecordsTitle: string;
          orderId: string;
          orderItemSelect: string;
          orderItemId: string;
          placeholderOrderId: string;
          placeholderSelectLine: string;
          placeholderOrderItemId: string;
          emptyHint: string;
          msgOrderIdRequired: string;
          msgOrderItemInvalid: string;
          msgNoItems: string;
          orderItemOptionLabel: string;
          columnId: string;
          columnLevel: string;
          columnBeneficiaryId: string;
          columnAmount: string;
          columnRateSnapshot: string;
          columnStatus: string;
          columnExplanation: string;
          columnCreateTime: string;
          status: {
            FROZEN: string;
            SETTLED: string;
            CANCELLED: string;
          };
        };
        store_order_activity_audit: {
          back: string;
          cardTitle: string;
          orderId: string;
          placeholderOrderId: string;
          descOrderId: string;
          cardItemsTitle: string;
          cardAuditTitle: string;
          emptyNoItems: string;
          emptyNoRecords: string;
          emptyPrompt: string;
          msgOrderIdRequired: string;
          columnOrderItemId: string;
          columnProductId: string;
          columnProductName: string;
          columnActivityType: string;
          columnActivityConfigId: string;
          columnCommissionMode: string;
          columnCommissionRate: string;
          columnSnapshot: string;
        };
        store_order_dispatch: {
          cardTitle: string;
          colOrderSn: string;
          colReceiverName: string;
          colReceiverPhone: string;
          colPayAmount: string;
          colStatus: string;
          statusPendingDispatch: string;
          colCreateTime: string;
          tooltipViewDetail: string;
          tooltipDispatch: string;
          msgWorkerRequired: string;
          msgDispatchOk: string;
          modalTitle: string;
          modalConfirm: string;
          modalHint: string;
        };
        store_order_detail: {
          backToList: string;
          actions: {
            verify: string;
            fullRefund: string;
            partialRefund: string;
            reassign: string;
            activityAudit: string;
            commissionAudit: string;
            refresh: string;
          };
          msg: {
            loadFail: string;
            verifyOk: string;
            refundOk: string;
            partialRefundOk: string;
            reassignOk: string;
            partialRefundNeedQty: string;
            reassignWorkerRequired: string;
            maxQtyPlaceholder: string;
          };
          notReached: string;
          emDash: string;
          orderStatus: {
            PENDING_PAY: string;
            PAID: string;
            PENDING_SERVICE: string;
            PENDING_DELIVERY: string;
            SHIPPED: string;
            COMPLETED: string;
            CANCELLED: string;
            REFUNDED: string;
          };
          commissionStatus: {
            FROZEN: string;
            SETTLED: string;
            CANCELLED: string;
          };
          timeline: {
            create: string;
            paid: string;
            workerAccept: string;
            serviceStart: string;
            serviceCompleteVerify: string;
            ship: string;
            confirmReceive: string;
            cancelled: string;
            refunded: string;
          };
          bizAction: {
            ORDER_REASSIGN_WORKER: string;
            ORDER_VERIFY: string;
            ORDER_REFUND: string;
            ORDER_PARTIAL_REFUND: string;
            ORDER_PRODUCT_SHIP: string;
            ORDER_PRODUCT_RECEIVE: string;
            ORDER_BATCH_VERIFY: string;
            ORDER_BATCH_REFUND: string;
            ORDER_BATCH_REMARK: string;
            ORDER_BATCH_STATUS_TRANSITION: string;
            MEMBER_LEVEL_UPDATE: string;
            MEMBER_MANUAL_LEVEL: string;
            MEMBER_POINT_ADJUST: string;
            MEMBER_UPGRADE_APPROVE: string;
            MEMBER_UPGRADE_REJECT: string;
          };
          operationLog: {
            time: string;
            action: string;
            operator: string;
            detail: string;
          };
          card: {
            progress: string;
            operationLog: string;
            orderInfo: string;
            productDetail: string;
            fundAllocation: string;
            fulfillment: string;
            shipping: string;
          };
          desc: {
            orderSn: string;
            createTime: string;
            orderStatus: string;
            customerNickname: string;
            customerMobile: string;
            attribution: string;
            tenant: string;
            shareUser: string;
            indirectShareUser: string;
            organicTraffic: string;
          };
          productTable: {
            product: string;
            spec: string;
            unitPrice: string;
            qty: string;
            subtotal: string;
            commissionAudit: string;
            view: string;
          };
          summary: {
            goodsTotal: string;
            freight: string;
            discount: string;
            paid: string;
          };
          commissionTable: {
            role: string;
            user: string;
            shareRate: string;
            amount: string;
            status: string;
            level1: string;
            level2: string;
            commissionDeductTotal: string;
            merchantReceipt: string;
            pendingSettlement: string;
            planSettle: string;
          };
          fulfillment: {
            worker: string;
            phone: string;
            rating: string;
            bookingTime: string;
          };
          shipping: {
            receiverName: string;
            receiverPhone: string;
            address: string;
            remark: string;
          };
          modalVerify: {
            title: string;
            confirm: string;
            remarkPlaceholder: string;
          };
          modalRefund: {
            title: string;
            confirm: string;
            remarkPlaceholder: string;
          };
          modalPartialRefund: {
            title: string;
            confirm: string;
            hint: string;
            remarkPlaceholder: string;
          };
          modalReassign: {
            title: string;
            confirm: string;
            hint: string;
          };
        };
        store_order_list: {
          cardTitle: string;
          export: string;
          batchVerify: string;
          batchRefund: string;
          batchShipReceive: string;
          batchRemark: string;
          columnOrderSn: string;
          columnOrderType: string;
          columnReceiverName: string;
          columnPayAmount: string;
          columnStatus: string;
          columnProductImg: string;
          columnReceiverPhone: string;
          columnCommissionAmount: string;
          columnRemainingAmount: string;
          columnReceiverAddress: string;
          columnTenantName: string;
          columnCreateTime: string;
          noImage: string;
          tooltipViewDetail: string;
          tooltipActivityAudit: string;
          tooltipCommissionAudit: string;
          exportFilename: string;
          msgSelectVerify: string;
          msgSelectRefund: string;
          msgSelectOrders: string;
          msgSelectRemark: string;
          msgRemarkRequired: string;
          modalBatchVerifyTitle: string;
          modalBatchVerifyConfirm: string;
          modalBatchVerifyRemarkPh: string;
          modalBatchRefundTitle: string;
          modalBatchRefundConfirm: string;
          modalBatchRefundRemarkPh: string;
          modalBatchStatusTitle: string;
          modalBatchStatusConfirm: string;
          modalBatchStatusHint: string;
          modalBatchStatusRadioShip: string;
          modalBatchStatusRadioComplete: string;
          modalBatchStatusRemarkPh: string;
          modalBatchRemarkTitle: string;
          modalBatchRemarkConfirm: string;
          modalBatchRemarkPh: string;
          remarkAppendLabel: string;
          batchResultIdColumn: string;
          batchVerifyDone: string;
          batchRefundDone: string;
          batchRemarkDone: string;
          batchShipDone: string;
          batchReceiveDone: string;
          batchVerifyResultTitle: string;
          batchRefundResultTitle: string;
          batchRemarkResultTitle: string;
          batchShipResultTitle: string;
          batchReceiveResultTitle: string;
          orderType: {
            PRODUCT: string;
            SERVICE: string;
          };
          search: {
            orderSn: string;
            orderSnPlaceholder: string;
            mobile: string;
            mobilePlaceholder: string;
            status: string;
            orderType: string;
            orderedAt: string;
            placeholderSelect: string;
            startDate: string;
            endDate: string;
            shortcutToday: string;
            shortcutYesterday: string;
            shortcutThisWeek: string;
            shortcutThisMonth: string;
          };
        };
        store_dispatch_worker_picker: {
          searchPlaceholder: string;
          columnId: string;
          columnName: string;
          columnPhone: string;
          columnStatus: string;
          columnOnlineToggle: string;
          onlineOn: string;
          onlineOff: string;
          workerStatus: {
            WORKING: string;
            RESTING: string;
            DISABLED: string;
            FROZEN: string;
            RESIGNED: string;
          };
          nickWrap: string;
          currentSelection: string;
          manualSectionTitle: string;
          manualIdPlaceholder: string;
          applyManual: string;
          manualSelectedLabel: string;
          msgInvalidWorkerId: string;
        };
        store_product_draft: {
          columnProductInfo: string;
          originalTitlePrefix: string;
          columnAuditStatus: string;
          auditDraft: string;
          auditRejected: string;
          columnRejectReason: string;
          columnSubmittedAt: string;
          dash: string;
          continueEdit: string;
          submitAudit: string;
          removeDraft: string;
          popSubmitAudit: string;
          popRemoveDraft: string;
          msgSubmitQueued: string;
          msgSelectDrafts: string;
          msgBatchSubmitDone: string;
          msgRemoved: string;
          tabDraft: string;
          tabRejected: string;
          batchSubmitAudit: string;
        };
        store_product_market: {
          importDialog: {
            modalTitle: string;
            typeLabel: string;
            typeReal: string;
            typeService: string;
            serviceRadiusLabel: string;
            serviceRadiusPlaceholder: string;
            suffixMeter: string;
            feedbackRadius: string;
            radiusNotSet: string;
            specConfigTitle: string;
            stockHintReal: string;
            stockHintService: string;
            colSpec: string;
            defaultSpec: string;
            colCost: string;
            colPrice: string;
            colStock: string;
            colDistMode: string;
            colDistRate: string;
            colProfit: string;
            msgLoss: string;
            msgSuccess: string;
            confirmImport: string;
          };
          card: {
            defaultSpecLabel: string;
            noDescription: string;
            guidePrice: string;
            imported: string;
            importNow: string;
            typeReal: string;
            typeService: string;
          };
          index: {
            categoryCardTitle: string;
            searchCategoryPlaceholder: string;
            emptyTree: string;
            tabAll: string;
            tabReal: string;
            tabService: string;
            downloadTemplate: string;
            batchExcel: string;
            templateVersionPlaceholder: string;
            templateLatestBadge: string;
            templateDefaultLatest: string;
            batchImport: string;
            searchNamePlaceholder: string;
            search: string;
            emptyProducts: string;
            msgSelectCategoryForTemplate: string;
            msgSelectProducts: string;
            msgNoSkus: string;
            batchImportDone: string;
            batchResultTitle: string;
            batchResultIdColumn: string;
            rootCategoryName: string;
            importRowId: string;
            downloadFilename: string;
          };
        };
        store_stock: {
          cardTitle: string;
          columnProduct: string;
          columnSpecs: string;
          columnStock: string;
          columnQuickAdjust: string;
          btnAdd: string;
          btnReduce: string;
          popoverQtyLabelAdd: string;
          popoverQtyLabelReduce: string;
          popoverReasonLabel: string;
          popoverReasonPh: string;
          msgUpdated: string;
          msgSelectSku: string;
          searchPlaceholder: string;
          search: string;
          reset: string;
          batchAdjust: string;
          export: string;
          exportFilename: string;
          batch: {
            title: string;
            hint: string;
            thProduct: string;
            thSpec: string;
            thCurrent: string;
            thChange: string;
            thReason: string;
            changePlaceholder: string;
            reasonOptional: string;
            msgNeedChange: string;
            msgDone: string;
            resultTitle: string;
            resultIdColumn: string;
          };
        };
      };
      form: {
        required: string;
        userName: FormMsg;
        phone: FormMsg;
        pwd: FormMsg;
        confirmPwd: FormMsg;
        code: FormMsg;
        email: FormMsg;
      };
      dropdown: Record<Global.DropdownKey, string>;
      icon: {
        themeConfig: string;
        themeSchema: string;
        lang: string;
        fullscreen: string;
        fullscreenExit: string;
        reload: string;
        collapse: string;
        expand: string;
        pin: string;
        unpin: string;
      };
      datatable: {
        itemCount: string;
        empty: string;
      };
    };

    type GetI18nKey<T extends Record<string, unknown>, K extends keyof T = keyof T> = K extends string
      ? T[K] extends Record<string, unknown>
        ? `${K}.${GetI18nKey<T[K]>}`
        : K
      : never;

    type I18nKey = GetI18nKey<Schema>;

    type TranslateOptions<Locales extends string> = import('vue-i18n').TranslateOptions<Locales>;

    interface $T {
      (key: I18nKey): string;
      (key: I18nKey, plural: number, options?: TranslateOptions<LangType>): string;
      (key: I18nKey, defaultMsg: string, options?: TranslateOptions<I18nKey>): string;
      (key: I18nKey, list: unknown[], options?: TranslateOptions<I18nKey>): string;
      (key: I18nKey, list: unknown[], plural: number): string;
      (key: I18nKey, list: unknown[], defaultMsg: string): string;
      (key: I18nKey, named: Record<string, unknown>, options?: TranslateOptions<LangType>): string;
      (key: I18nKey, named: Record<string, unknown>, plural: number): string;
      (key: I18nKey, named: Record<string, unknown>, defaultMsg: string): string;
    }

    /** Service namespace */
    namespace Service {
      /** Other baseURL key */
      type OtherBaseURLKey = 'demo';

      interface ServiceConfigItem {
        /** The backend service base url */
        baseURL: string;
        /** The proxy pattern of the backend service base url */
        proxyPattern: string;
        ws?: boolean;
      }

      interface OtherServiceConfigItem extends ServiceConfigItem {
        key: OtherBaseURLKey;
      }

      /** The backend service config */
      interface ServiceConfig extends ServiceConfigItem {
        /** Other backend service config */
        other: OtherServiceConfigItem[];
      }

      interface SimpleServiceConfig extends Pick<ServiceConfigItem, 'baseURL'> {
        other: Record<OtherBaseURLKey, string>;
      }

      /** The backend service response data */
      type Response<T = unknown> = {
        /** The backend service response code */
        code: string | number;
        /** The backend service response message */
        msg: string;
        /** The alternate backend service response message */
        message?: string;
        /** The backend service response data */
        data: T;
        /** The request id */
        requestId?: string;
        /** The trace id */
        traceId?: string;
        /** The error event id */
        errorId?: string;
        /** The business operation code */
        operationCode?: string;
        /** The business step code */
        stepCode?: string;
        /** The business step name */
        stepName?: string;
        rows?: any[];
        total?: number;
      };

      /** The demo backend service response data */
      type DemoResponse<T = unknown> = {
        /** The backend service response code */
        status: string;
        /** The backend service response message */
        message: string;
        /** The backend service response data */
        result: T;
      };
    }
  }
}
