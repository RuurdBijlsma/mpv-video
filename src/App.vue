<template>
    <div id="app">
        <img alt="Vue logo" src="./assets/logo.png">
<!--        <mpv-video height="auto" controls-->
<!--                   src="C:/Users/Ruurd/WebstormProjects/mpv-electron/tos.mkv"-->
<!--        />-->
<!--        <mpv-video height="auto" controls-->
<!--                   src="C:/Users/Ruurd/WebstormProjects/mpv-electron/nothere.mkv"-->
<!--        />-->
        <mpv-video height="auto" controls
                   src="https://192-168-0-130.dc965f94e7414eae9f7d89cf35b1222d.plex.direct:32400/video/:/transcode/universal/start.m3u8?X-Plex-Token=SCJsy7DHs8dYmyRarLmr&protocol=hls&mediaIndex=0&offset=0&path=%2Flibrary%2Fmetadata%2F8703&directPlay=1&directStream=1&fastSeek=1&X-Plex-Platform=Chrome"
        />
    </div>
</template>

<script>
// TODO ----------================{{{{{{{{ TODO }}}}}}}===============----------- TODO //
// Subtitles
// build system media notification into this (niet gaar maken)
// Demuxer cache state werkend maken (not possible)
// eof-reached happens on file load, but shouldn't
// File not found error happens before loading sometimes

// ---------------================{{{{{{{{ DONE }}}}}}}===============---------------- //
// Error handling (file not found, etc)
import MpvEmbed from "@/components/MpvEmbed";
import MpvVideo from "@/components/MpvVideo";

export default {
    name: 'App',
    components: {
        MpvVideo,
        MpvEmbed,
    }
}
</script>

<style>
html, body {
    margin: 0;
}

.mpv-video {
    width: 100%;
}
</style>
