import { ref } from 'vue';
import { fetchPublishScene, fetchScenePublishPrecheck } from '@/service/api/marketing/scene';

// 发布预检是场景上线前的前端护栏：检查路由、模块、策略和出数风险，
// 但是否允许发布仍以后端 precheck + publish 两步结果为准。
interface PublishSceneOptions {
  onPublished?: () => void;
}

export function useScenePrecheck() {
  const precheckingSceneCode = ref<string | null>(null);
  const publishingSceneCode = ref<string | null>(null);
  const precheckResultVisible = ref(false);
  const latestPrecheckResult = ref<Api.Marketing.ScenePublishPrecheckResult | null>(null);

  function openPrecheckResult(result: Api.Marketing.ScenePublishPrecheckResult) {
    latestPrecheckResult.value = result;
    precheckResultVisible.value = true;
  }

  async function runPrecheck(
    sceneCode: string,
    options: {
      showSuccessMessage?: boolean;
      openReportOnPass?: boolean;
      openReportOnFail?: boolean;
      /** 预检请求期间占用哪一类「行内 loading」：独立预检按钮 vs 发布流程内的预检 */
      loadingTarget?: 'precheck' | 'publish';
    } = {},
  ): Promise<Api.Marketing.ScenePublishPrecheckResult | null> {
    const {
      showSuccessMessage = false,
      openReportOnPass = true,
      openReportOnFail = true,
      loadingTarget = 'precheck',
    } = options;

    function setRowLoading(active: boolean) {
      const code = active ? sceneCode : null;
      if (loadingTarget === 'publish') {
        publishingSceneCode.value = code;
      } else {
        precheckingSceneCode.value = code;
      }
    }

    setRowLoading(true);
    try {
      const { data } = await fetchScenePublishPrecheck(sceneCode);
      const result = data ?? null;
      if (!result) {
        return null;
      }
      latestPrecheckResult.value = result;

      if (result.pass) {
        if (showSuccessMessage) {
          window.$message?.success('预检通过，可发布');
        }
        if (openReportOnPass) {
          openPrecheckResult(result);
        }
      } else if (openReportOnFail) {
        openPrecheckResult(result);
      }

      return result;
    } catch {
      window.$message?.error('预检请求失败，请稍后重试');
      return null;
    } finally {
      setRowLoading(false);
    }
  }

  async function handlePrecheck(sceneCode: string) {
    await runPrecheck(sceneCode, {
      showSuccessMessage: true,
      openReportOnPass: true,
      openReportOnFail: true,
    });
  }

  async function handlePublish(sceneCode: string, options: PublishSceneOptions = {}) {
    // 发布动作内部强制再跑一次预检，避免运营在预检后修改配置再直接发布。
    const precheck = await runPrecheck(sceneCode, {
      showSuccessMessage: false,
      openReportOnPass: false,
      openReportOnFail: true,
      loadingTarget: 'publish',
    });
    if (!precheck) {
      return;
    }
    if (!precheck.pass) {
      window.$message?.warning('发布前预检未通过，请先处理问题');
      return;
    }

    window.$dialog?.warning({
      title: '确认发布',
      content: '发布后 C 端将按最新快照生效，是否继续？',
      positiveText: '确认发布',
      negativeText: '取消',
      onPositiveClick: async () => {
        publishingSceneCode.value = sceneCode;
        try {
          await fetchPublishScene(sceneCode);
          window.$message?.success('发布成功');
          precheckResultVisible.value = false;
          options.onPublished?.();
        } finally {
          publishingSceneCode.value = null;
        }
      },
    });
  }

  return {
    precheckingSceneCode,
    publishingSceneCode,
    precheckResultVisible,
    latestPrecheckResult,
    handlePrecheck,
    handlePublish,
  };
}
