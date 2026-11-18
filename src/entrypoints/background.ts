export default defineBackground(() => {
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e: unknown) => {
    console.error('[background] setPanelBehavior failed', e);
  });
});
