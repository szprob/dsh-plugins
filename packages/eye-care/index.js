/**
 * 护眼模式 bundle 的 Host 半边。
 *
 * 这是一个纯浏览器外观插件：配色层由 client.js 通过 `ctx.theme.overrideTokens`
 * 叠加在当前浅色/深色主题之上，开关状态按浏览器存在 localStorage。Host 侧不需要
 * 任何行为，这一行存在的意义是让 Loader 有一个可启用条目，`dsh.client` 才能把
 * 浏览器半边下发给页面。
 */

/** Host 插件主体：无 Host 侧行为。 */
export function apply() {}
