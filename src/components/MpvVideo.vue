<template>
    <div>
        hello mpv
        <div ref="player"></div>
    </div>
</template>

<script>
export default {
    name: "MpvVideo",
    mounted() {
        var embed = document.createElement('embed');
        embed.type = 'application/x-mpvjs';

        this.$refs.player.appendChild(embed);
        //IT WORK :)))
        embed.addEventListener('message', function (recv) {
            if (recv.data.type === 'ready') {
                var type = 'command';
                var data = ['loadfile', 'C:/Users/Ruurd/WebstormProjects/mpv-electron/tos.mkv'];
                // var data = ['loadfile', 'https://192-168-0-130.dc965f94e7414eae9f7d89cf35b1222d.plex.direct:32400/video/:/transcode/universal/start.m3u8?X-Plex-Token=SCJsy7DHs8dYmyRarLmr&protocol=hls&mediaIndex=0&offset=0&path=%2Flibrary%2Fmetadata%2F8703&directPlay=1&directStream=1&fastSeek=1&X-Plex-Platform=Chrome'];
                const send = {type, data};
                embed.postMessage(send);
                setTimeout(() => {
                    console.log("Sending unpause")
                    embed.postMessage({type: 'set_property', data: {name: 'pause', value: false}})
                    setTimeout(() => {
                        // console.log("Sending pause")
                        // embed.postMessage({type: 'set_property', data: {name: 'pause', value: true}})
                    }, 4000);
                }, 2000);
            }
        });
    },
}
</script>

<style scoped>

</style>
