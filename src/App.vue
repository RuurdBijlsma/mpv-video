<template>
    <div id="app">
        <img alt="Vue logo" src="./assets/logo.png">
        <mpv-video></mpv-video>
    </div>
</template>

<script>
import MpvVideo from "@/components/MpvVideo";

export default {
    name: 'App',
    components: {
        MpvVideo,
    }
}
</script>

<style>

</style>
