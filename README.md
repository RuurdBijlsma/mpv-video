# `<mpv-video>`

mpv player component for [vue-electron-builder](https://github.com/nklayman/vue-cli-plugin-electron-builder) projects (will also work in other Vue/Electron projects). This component was made to work as similarly to `<video>` as possible,
when `controls` are enabled they will look similar to Chrome's `<video controls>`. 

Demo Electron app can be found here: https://github.com/RuurdBijlsma/mpv-video-demo

### Example usage in a Vue single file component:

```html
<template>
    <mpv-video height="300" width="auto" controls src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"/>
</template>

<script>
    import mpvVideo from "mpv-video";

    export default {
        components: {mpvVideo},
    }
</script>
```

### Screenshot of `<mpv-video controls>` and `<video controls>`

![f](https://github.com/ruurdbijlsma/mpv-video/blob/master/.gh/video-and-mpvvideo.png?raw=true)

## Extra features (That aren't in `<video>`)

* Any codec supported in mpv is supported in this player.
* Custom props
    * `start-time` set start time of video (place in seconds the video initially loads into)
    * `cover-poster` determines if the poster should cover the player or be contained within the player

## Differences with `<video>`

* Both `height` and `width` need to be specified, either by CSS or by HTML props. If you want height and/or width to be determined based on aspect ratio set that HTML property to `'auto'` like so: `<mpv-video height="auto" width="400">`
* Only tested on x64 Windows for now
* This is a Vue component, so some things will work differently, such as events, and programmatically setting certain
  props
* I can't get the seekable-ranges property to work, so the `.buffered` member returns that
  everything is buffered.
* `.canPlayType(mediaType)` always returns `'probably'`
* `srcObject` and `captureStream` are not supported
* Subtitles are handled by mpv, add a subtitles track by calling `.addTextTrack(filepath)` on the mpvVideo VueComponent.
  This file can be of any subtitles filetype that mpv supports.
* `picture-in-picture` is not supported
* Only `'nofullscreen'` of `.controlsList` is supported, this disables the fullscreen button when controls are enabled.

## Installation

1. For now mpv is not packaged, meaning you need to install the mpv library first:
    * Windows: download [mpv-dev](https://mpv.srsfckn.biz/mpv-dev-latest.7z), unpack, put corresponding `mpv-1.dll` to `C:\Windows\system32`
    * macOS: `brew install mpv`
    * Linux: `apt-get install libmpv1 libavformat-dev`
2. `npm install mpv-video`
3. Make sure `electron` and `vue` are installed alongside this (they are peer
   dependencies)
4. Make sure `nodeIntegration: true` are specified in `vue.config.js` as shown below.

```js
module.exports = {
    pluginOptions: {
        electronBuilder: {
            nodeIntegration: true,
        }
    },
}
```

5. When creating your browserWindow in Electron, in `webPreferences` enable plugins:

```js
const win = new BrowserWindow({
    webPreferences: {
        plugins: true,
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
    }
})
```

6. At the start of your `background.js` file, add the following to enable the mpv plugin:
```js
import {installMpv} from 'mpv-video/js/mpv-utils';
installMpv(app);
```
