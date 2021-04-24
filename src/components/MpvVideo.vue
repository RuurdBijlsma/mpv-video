<template>
    <div class="mpv-video"
         :style="mainStyle"
         @mousemove="moveOverPlayer"
         ref="player"
         @keydown="handleKey"
         @wheel="handleScroll"
         tabindex="1">
        <loading-ring class="loading-ring" :style="{opacity: buffering ? 1 : 0}"/>
        <mpv-embed
            @property_change="handlePropertyChange"
            ref="mpv" class="canvas-center" :style="{
            backgroundImage: poster === '' ? 'none' : `url(${poster})`,
            backgroundSize: coverPoster ? 'cover' : 'contain',
        }"/>
        <controls v-if="controls"
                  @mouseenter.native="mouseOverControls=true"
                  @mouseleave.native="mouseOverControls=false"
                  @play="play"
                  @pause="pause"
                  @seek="player.state['percent-pos'] = $event * 100"
                  @toggleFullscreen="toggleFullscreen"
                  @toggleMute="player.toggleMute()"
                  :mouse-over-controls="mouseOverControls"
                  :current-time="currentTime"
                  :duration="duration"
                  :muted="muted" :paused="paused" :bounds="bounds" :position="position"
                  :disable-fullscreen="controlsList.includes('nofullscreen')"
                  v-model="volume"
                  :style="{
                      opacity: hideControls && !mouseOverControls && !paused ? 0 : readyState < 2 ? 0.5 : 1,
                      pointerEvents: readyState < 2 ? 'none' : 'all',
                  }"/>
    </div>
</template>

<script>

import LoadingRing from "./LoadingRing";
import Controls from "./Controls";
import Utils from "../js/utils";
import MpvEmbed from "@/components/MpvEmbed";
import net from 'net'
import xpipe from 'xpipe'
import path from 'path'

export default {
    name: "MpvVideo",
    components: {MpvEmbed, Controls, LoadingRing},
    props: {
        // ------- HTML Video properties -------- //
        autoplay: {
            type: Boolean,
            default: false,
        },
        controls: {
            type: Boolean,
            default: false,
        },
        src: {
            type: String,
            default: '',
        },
        width: {
            type: [Number, String],
            default: 0,
        },
        height: {
            type: [Number, String],
            default: 0,
        },
        poster: {
            type: String,
            default: '',
        },
        loop: {
            type: Boolean,
            default: false,
        },
        // ---------- Miscellaneous -------- //
        hideBuffering: {
            type: Boolean,
            default: false,
        },
        coverPoster: {
            type: Boolean,
            default: false,
        },
        dark: {
            type: Boolean,
            default: false,
        },
        enableStatus: {
            type: Boolean,
            default: false,
        },
        enableScroll: {
            type: Boolean,
            default: false,
        },
        enableKeys: {
            type: Boolean,
            default: false,
        },
    },
    data: () => ({
        computedBounds: {width: 0, height: 0},
        player: null,
        interval: null,
        buffering: false,
        preventStatusUpdate: false,
        statusAnimationDuration: '0s',
        statusOpacity: 0,
        volumeInput: 1,
        dontWatchTime: false,
        moveTimeout: -1,
        showBufferTimeout: -1,
        hideControls: false,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        mouseOverControls: false,
        icons: {},
        firstPlayLoaded: false,
        resizeInterval: -1,
        // Video element properties //
        defaultPlaybackRate: 1,
        playbackRate: 1,
        duration: NaN,
        videoWidth: 0,
        videoHeight: 0,
        readyState: HTMLMediaElement.HAVE_NOTHING,
        volume: 1,
        muted: false,
        paused: true,
        currentTime: 0,
        controlsList: [],
        crossOrigin: '',
        defaultMuted: false,
        ended: false,
        error: null,
        networkState: HTMLMediaElement.NETWORK_EMPTY,
        seeking: false,
        srcObject: null,
    }),
    beforeDestroy() {
        clearInterval(this.interval);
        clearInterval(this.resizeInterval);
        clearTimeout(this.moveTimeout);
        clearTimeout(this.showBufferTimeout);
        this.player?.destroy?.();
        window.removeEventListener('resize', this.windowResize);
        document.removeEventListener('fullscreenchange', this.changeFullscreen);
    },
    async mounted() {
        let icons = ['pause', 'play_arrow', 'stop', 'volume_up', 'volume_down', 'volume_off', 'volume_off', 'info', 'info'];
        Promise.all(icons.map(Utils.nativeIcon))
            .then(result => {
                result.forEach((icon, i) => this.icons[icons[i]] = icon);
            });

        this.init();

        // this.interval = setInterval(() => {
        //     if (this.player.state === 'buffering')
        //         this.showBuffering();
        // }, 1000 / 50);
        this.resizeInterval = setInterval(() => {
            this.windowResize();
        }, 1000 / 20);

        this.moveTimeout = setTimeout(() => {
            this.hideControls = true;
        }, 1000);

        this.windowResize();
        window.addEventListener('resize', this.windowResize, false);
        document.addEventListener('fullscreenchange', this.changeFullscreen, false);
    },
    methods: {
        init() {
            this.player = this.$refs.mpv;
            console.log('player', this.player);
            this.player.ready.then(() => {
                this.player.command['load-script'](path.join(__static, 'script.js'));
                this.player.observe(
                    'width', 'height', 'duration', 'pause', 'time-pos',
                    'demuxer-cache-idle', 'demuxer-cache-duration', 'paused-for-cache', 'cache-buffering-state', 'cache-speed',
                    'seeking', 'seekable', 'idle-active',
                );

                setTimeout(() => {
                    console.log("Connecting... to /mpvsocket")
                    const client = net.connect(xpipe.eq('/mpvsocket'), () => {
                        console.log('connected to IPC server')
                        const command = JSON.stringify(
                            {'command': ['observe_property', 1, 'demuxer-cache-state'], 'request_id': 101}
                        )
                        client.write(Buffer.from(command + '\n'))
                    })

                    client.on('error', e => console.warn('error', e));
                    client.on('close', e => console.warn('close', e));
                    client.on('timeout', e => console.warn('timeout', e));

                    client.on('data', (res) => {
                        res = res.toString('utf8')
                        res = res.trim()
                        res = `[${res}]`
                        res = res.replace(/(\r\n|\n|\r)/g, ',')
                        res = JSON.parse(res)
                        res.forEach((key) => {
                            console.log('key',key);
                            if (key.event === 'property-change' && key.name === 'demuxer-cache-state') {
                                if (key.data !== null) console.log(key.data)
                            }
                        })
                    })
                }, 1000);
            });
            // let firstPlay = true, firstPause = true;
            //
            // this.player.on('stop', () => {
            //     this.paused = true;
            //     this.$emit('pause');
            //     console.log('⏹')
            // });
            // this.player.on('mute', () => {
            //     this.muted = true;
            //     console.log('🔇')
            // });
            // this.player.on('unmute', () => {
            //     this.muted = false;
            //     console.log(`🔊 ${Math.round(this.player.volume)}%`)
            // });
            // this.player.on('volumeChange', v => {
            //     this.volume = v / 100;
            //     this.$emit('volumechange', v / 100);
            //     console.log(`${this.player.mute ? '🔇' : '🔊'} ${Math.round(v)}%`)
            // });
            // this.player.input.on('rateChange', v => {
            //     this.playbackRate = v;
            //     this.$emit('ratechange', v);
            //     console.log(`🐢 ${v.toFixed(2)}x`)
            // });
            // this.player.on('seek', () => {
            //     this.$emit('seeking');
            //     this.$emit('seeked');
            //     console.log(`${this.msToTime(this.player.time)} / ${this.msToTime(this.player.duration)}`)
            // });
            // this.player.on('load', () => {
            //     this.videoResize();
            //
            //     this.readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
            //     this.duration = this.player.duration / 1000;
            //
            //     this.$emit('loadedmetadata');
            //     this.$emit('loadeddata');
            // });
            // this.player.on('time', () => {
            //     let newTime = this.player.time / 1000;
            //     if (newTime !== this.currentTime) {
            //         this.dontWatchTime = true;
            //         this.currentTime = newTime;
            //     }
            // });
            // this.player.on('ended', () => {
            //     if (this.loop) {
            //         this.currentTime = 0;
            //         this.player.once('stop', () => {
            //             this.player.play();
            //             this.player.once('pause', this.player.play);
            //         });
            //     } else {
            //         this.$emit('ended');
            //         this.ended = true;
            //     }
            // });
            //
            // this.player.on('durationChange', duration => {
            //     this.$emit('durationchange', duration / 1000);
            //     this.duration = duration / 1000;
            // });
            //
            // this.player.on('error', err => {
            //     this.error = 'VLC error' + err;
            //     this.$emit('stalled');
            //     this.$emit('error', ['VLC error', err]);
            // });
            //
            // this.player.on('mediaChange', () => {
            //     firstPlay = true;
            //     firstPause = true;
            //     let onStateChange = newState => {
            //         if (newState === 'play' || newState === 'pause') {
            //             this.player.off('stateChange', onStateChange);
            //             this.readyState = HTMLMediaElement.HAVE_FUTURE_DATA;
            //             this.$emit('canplay');
            //             this.readyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
            //             this.$emit('canplaythrough');
            //             this.networkState = HTMLMediaElement.NETWORK_IDLE;
            //         }
            //     }
            //     this.player.once('frameReady', () => {
            //         if (!this.autoplay) {
            //             this.player.mute = this.defaultMuted;
            //             this.player.pause();
            //             this.player.once('pause', () => this.preventStatusUpdate = false);
            //         }
            //     });
            //     this.player.on('stateChange', onStateChange);
            // });
            //
            // let currentState = this.player.state;
            // this.player.on('stateChange', newState => {
            //     console.log('new state', newState)
            //     if (currentState === 'buffering' && (newState === 'play' || newState === 'pause')) {
            //         this.$emit('playing');
            //     }
            //     currentState = newState;
            //     if (newState === 'buffering')
            //         this.showBuffering();
            // });

            this.loadSrc();
        },
        handlePropertyChange({name, value}) {
            switch (name) {
                case 'pause':
                    this.paused = value;
                    if (value)
                        this.$emit('pause');
                    else
                        this.$emit('play');
                    break;
                case 'width':
                    this.videoWidth = value;
                    break;
                case 'height':
                    this.videoHeight = value;
                    break;
                case 'duration':
                    this.duration = value;
                    break;
                case 'time-pos':
                    this.currentTime = value;
                    break;
                case 'seekable':
                    this.readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
                    break;
                case 'demuxer-cache-duration':
                    if (value > 0.1)
                        this.readyState = HTMLMediaElement.HAVE_FUTURE_DATA;
                    break;
                case 'demuxer-cache-idle':
                    this.networkState = value ? HTMLMediaElement.NETWORK_IDLE : HTMLMediaElement.NETWORK_LOADING;
                    break;
                default:
                    console.log("Unhandled property change", name, value)
                    break;
            }
        },
        showBuffering() {
            this.$emit('waiting');
            if (this.hideBuffering) return;
            clearTimeout(this.showBufferTimeout);

            this.buffering = true;
            this.showBufferTimeout = setTimeout(() => {
                this.buffering = false;
            }, 300);
        },
        changeFullscreen() {
            this.fullscreen = document.fullscreenElement === this.$refs.player;
            this.windowResize();
            this.$nextTick(() => this.windowResize());
        },
        moveOverPlayer(e) {
            if (e.movementX > 0 || e.movementY > 0) {
                this.hideControls = false;
                clearTimeout(this.moveTimeout);
                this.moveTimeout = setTimeout(() => {
                    this.hideControls = true;
                }, 1000);
            }
        },
        msToTime(ms, keepMs = false) {
            return Utils.msToTime(ms, keepMs);
        },
        handleScroll(e) {
            if (!this.enableScroll)
                return;
            this.player.volume -= e.deltaY / 20;
        },
        handleKey(e) {
            if (!this.enableKeys)
                return;
            switch (true) {
                case e.key === ' ':
                    this.player.togglePause();
                    break;
                case e.key === 'ArrowRight':
                    this.player.time += 10000;
                    break;
                case e.key === 'ArrowLeft':
                    this.player.time -= 10000;
                    break;
                case e.key === 'ArrowUp':
                    this.player.volume += 5;
                    break;
                case e.key === 'ArrowDown':
                    this.player.volume -= 5;
                    break;
                case e.key === '=':
                    let rateUp = this.player.input.rate * 1.25;
                    this.player.input.rate = rateUp > 0.5 ? Math.round(rateUp * 4) / 4 : rateUp;
                    break;
                case e.key === '-':
                    let rateDown = this.player.input.rate / 1.25;
                    this.player.input.rate = rateDown > 0.5 ? Math.round(rateDown * 4) / 4 : rateDown;
                    break;
                case e.key === 'm':
                    this.player.mute = !this.player.mute;
                    break;
            }
        },
        async addSubtitles() {
            let {filePath, canceled} = await this.promptSubtitleFile();
            if (!canceled) {
                this.player.subtitles.load(filePath);
            }
        },
        async promptSubtitleFile() {
            let {dialog} = require('electron').remote
            let {canceled, filePaths} = await dialog.showOpenDialog({
                title: "Add subtitles from file",
                buttonLabel: "Add subtitles",
                filters: [{
                    name: "Subtitle files",
                    extensions: ['cdg', 'idx', 'srt', 'sub', 'utf',
                        'ass', 'ssa', 'aqt', 'jss', 'psb', 'rt',
                        'sami', 'smi', 'txt', 'smil', 'stl', 'usf', 'dks',
                        'pjs', 'mpl2', 'mks', 'vtt', 'tt', 'ttml', 'dfxp', 'scc']
                }, {
                    name: "All files",
                    extensions: ['*']
                }],
                properties: ['openFile']
            })
            return {canceled, filePath: filePaths[0]};
        },
        async loadSrc() {
            // this.player.stop();

            this.preventStatusUpdate = true;
            this.duration = NaN;
            this.ended = false;
            this.readyState = HTMLMediaElement.HAVE_NOTHING;
            this.networkState = HTMLMediaElement.NETWORK_LOADING;
            this.videoWidth = 0;
            this.videoHeight = 0;
            this.currentTime = 0;
            this.error = null;
            this.firstPlayLoaded = false;

            if (this.src === '') {
                this.networkState = HTMLMediaElement.NETWORK_NO_SOURCE;
            }
            console.log("Loading src", this.src);
            await this.player.ready;
            this.player.command.loadFile(this.src);
            this.$on('play', () => {
                this.firstPlayLoaded = true
            });
            this.$emit('loadstart');
        },
        windowResize() {
            this.windowWidth = window.innerWidth;
            this.windowHeight = window.innerHeight;
            let container = this.$refs.player;
            this.computedBounds = {
                width: container.offsetWidth,
                height: container.offsetHeight,
                left: container.offsetLeft,
                top: container.offsetTop,
            };
        },
        toggleFullscreen() {
            if (this.fullscreen) {
                document.exitFullscreen();
            } else {
                let container = this.$refs.player;
                container.requestFullscreen();
            }
        },
        // ------------ HTMLVideoElement methods ---------- //
        addTextTrack(filePath) {
            this.player.subtitles.load(filePath);
        },
        captureStream() {
            console.warn("Not implemented");
        },
        canPlayType() {
            return 'probably';
        },
        fastSeek(t) {
            this.player.time = t * 1000;
        },
        load() {
            // todo this doesnt work well
            if (this.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
                this.$emit('abort');
            } else {
                this.$emit('emptied');
            }
            this.player.destroy();
            this.init();
        },
        async play() {
            if (this.src === '')
                return;
            this.player.state.pause = false;
            return new Promise(resolve => this.player.$once('play', resolve));
        },
        pause() {
            this.player.state.pause = true;
        },
        seekToNextFrame(n = 1) {
            this.player.time += (1000 * n) / this.player.input.fps;
        },
    },
    computed: {
        mainStyle() {
            let style = {
                '--width': `${this.bounds.width}px`,
                '--height': `${this.bounds.height}px`,
                cursor: this.hideControls && !this.mouseOverControls && !this.paused ? 'none' : 'auto',
            }
            if (this.height === 'auto')
                style.height = this.bounds.height + 'px';
            if (this.height !== 0)
                style.height = this.bounds.height + 'px';
            if (this.width === 'auto')
                style.width = this.bounds.width + 'px';
            if (this.width !== 0)
                style.width = this.bounds.width + 'px';
            return style;
        },
        bounds() {
            return {
                ...this.computedBounds,
                width: this.width === 'auto' ? this.canvasBounds.width :
                    this.width !== 0 ? +this.width :
                        Math.max(this.computedBounds.width, this.canvasBounds.width),
                height: this.height === 'auto' ? this.canvasBounds.height :
                    this.height !== 0 ? +this.height :
                        Math.max(this.computedBounds.height, this.canvasBounds.height),
            };
        },
        canvasBounds() {
            let width, height;
            if (this.height === 'auto' && this.width === 'auto') {
                return {width: this.videoWidth, height: this.videoHeight};
            } else if (this.height === 'auto') {
                width = this.computedBounds.width;
                height = width / this.aspectRatio;
            } else if (this.width === 'auto') {
                height = this.computedBounds.height;
                width = height * this.aspectRatio;
            } else {
                let containerRatio = this.computedBounds.width / this.computedBounds.height;
                if (this.aspectRatio > containerRatio) {
                    width = this.computedBounds.width;
                    height = width / this.aspectRatio;
                } else {
                    height = this.computedBounds.height;
                    width = height * this.aspectRatio;
                }
            }
            return {width, height};
        },
        // ------------ HTMLVideoElement getters ---------- //
        currentSrc() {
            return this.src;
        },
        audioTracks: {
            cache: false,
            get() {
                let audio = this.player.audio;
                return audio.tracks.slice(1).map((track, i) => ({
                    get enabled() {
                        return audio.track === i + 1
                    },
                    set enabled(v) {
                        if (v) audio.track = i + 1
                        else if (audio.track === i + 1) audio.track = 0
                    },
                    id: i,
                    kind: i === 0 ? 'main' : 'alternative',
                    label: track,
                    language: '',
                    sourceBuffer: null,
                }))
            },
        },
        textTracks: {
            cache: false,
            get() {
                let subtitles = this.player.subtitles;
                return subtitles.tracks.slice(1).map((track, i) => ({
                    get enabled() {
                        return subtitles.track === i + 1
                    },
                    set enabled(v) {
                        if (v) subtitles.track = i + 1
                        else if (subtitles.track === i + 1) subtitles.track = 0
                    },
                    id: i,
                    kind: i === 0 ? 'main' : 'alternative',
                    label: track,
                    language: '',
                    sourceBuffer: null,
                }))
            },
        },
        videoTracks: {
            cache: false,
            get() {
                let video = this.player.video;
                return video.tracks.slice(1).map((track, i) => ({
                    get selected() {
                        return video.track === i + 1
                    },
                    set selected(v) {
                        if (v) video.track = i + 1
                        else if (video.track === i + 1) video.track = 0
                    },
                    id: i,
                    kind: i === 0 ? 'main' : 'alternative',
                    label: track.name,
                    size: {
                        width: track.width,
                        height: track.height,
                    },
                    language: '',
                    sourceBuffer: null,
                }))
            },
        },
        buffered: {
            cache: false,
            get() {
                return {
                    length: 1, start: () => {
                        return 0
                    }, end: () => {
                        return this.duration
                    }
                };
            },
        },
        seekable() {
            return this.readyState > 0;
        },
        // ---------------- Miscellaneous ----------------- //
        position() {
            if (this.duration && this.duration !== 0)
                return this.currentTime / this.duration;
            return 0;
        },
        aspectRatio() {
            return (this.videoWidth !== 0 && this.videoHeight !== 0) ? this.videoWidth / this.videoHeight : 16 / 9;
        },
        userWidth() {
            return this.width === 0 ? undefined : +this.width;
        },
        userHeight() {
            return this.height === 0 ? undefined : +this.height;
        },
    },
    watch: {
        currentTime(newValue, oldValue) {
            if (newValue !== oldValue) {
                this.$emit('timeupdate', newValue);
            }
            if (newValue !== oldValue && !this.dontWatchTime)
                this.player.time = this.currentTime * 1000;
            else if (this.dontWatchTime)
                this.dontWatchTime = false;
        },
        playbackRate(newValue, oldValue) {
            if (newValue !== oldValue)
                this.player.input.rate = this.playbackRate;
        },
        volume(newValue, oldValue) {
            if (newValue !== oldValue)
                this.player.volume = this.volume * 100;
        },
        width() {
            this.$nextTick(() => this.windowResize());
        },
        height() {
            this.$nextTick(() => this.windowResize());
        },
        videoWidth() {
            this.$nextTick(() => this.windowResize());
        },
        videoHeight() {
            this.$nextTick(() => this.windowResize());
        },
        src() {
            this.loadSrc()
        },
    },
}
</script>

<style scoped>
.mpv-video {
    display: inline-block;
    --width: 100px;
    --height: 50px;
    position: relative;
}

.mpv-video:focus {
    outline: none;
}

.canvas-center {
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    width: 100%;
    height: 100%;
    display: flex;
    place-items: center;
    justify-content: center;
    z-index: 1;
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
}

.status-text {
    font-family: "Segoe UI Symbol", Symbol, sans-serif;
    font-size: calc(var(--width) / 18);
    text-align: right;
    color: white;
    text-shadow: 0 0 calc(var(--width) / 100) black;
    position: absolute;
    top: 10%;
    right: 10%;
    z-index: 3;
}

.loading-ring {
    position: absolute;
    top: 10%;
    left: 10%;
    z-index: 3;
}

.content >>> div {
    margin: 5px 0;
}

.content >>> div > b {
    user-select: none;
}
</style>
