import { chromium } from '@playwright/test';
for (const mode of ['hardware','software']) {
 const browser = await chromium.launch(mode === 'hardware' ? {channel:'chrome',headless:false,args:['--enable-gpu']} : {headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 const page = await browser.newPage(); await page.goto('http://127.0.0.1:4188/');
 const info = await page.evaluate(async () => {
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createGroundGlassRttResources}=await import('/src/render/groundGlassRttResources.ts');
  const renderer=new THREE.WebGLRenderer(); const gl=renderer.getContext(); const ext=gl.getExtension('WEBGL_debug_renderer_info');
  const resources=createGroundGlassRttResources({renderer,widthPx:64,heightPx:64,gatherScale:1});
  renderer.setRenderTarget(resources.scene.colorDepthTarget);
  const out={renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), version:gl.getParameter(gl.VERSION), requestedType:resources.scene.colorDepthTarget.depthTexture.type, framebufferStatus:gl.checkFramebufferStatus(gl.FRAMEBUFFER), framebufferComplete:gl.FRAMEBUFFER_COMPLETE, attachmentType:gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE), depthBits:gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE), error:gl.getError()};
  renderer.setRenderTarget(null); resources.dispose(); renderer.dispose(); return out;
 }); console.log(JSON.stringify({mode,...info})); await browser.close();
}
