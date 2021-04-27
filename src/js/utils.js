import {app, nativeImage} from "electron";
import path from "path";
import {getPluginEntry} from "mpv.js";
import fs from "fs";

export function installMpv(app) {
    const pluginDir = path.resolve(path.join(path.dirname(require.resolve("mpv.js")), "build", "Release"));
    const filePath = path.join(pluginDir, 'mpvjs.node');
    const pluginEntry = getPluginEntry(pluginDir);
    console.log({
        pluginDir,
        filePath,
        exists: fs.existsSync(filePath),
        pluginEntry
    });
    if (process.platform !== "linux")
        process.chdir(pluginDir);
    app.commandLine.appendSwitch("no-sandbox");
    app.commandLine.appendSwitch("ignore-gpu-blacklist");
    app.commandLine.appendSwitch("register-pepper-plugins", pluginEntry);
}

export function msToTime(ms, keepMs = false) {
    if (isNaN(ms))
        return `00:00` + keepMs ? '.00' : '';
    let hms = new Date(ms).toISOString().substr(11, keepMs ? 11 : 8).replace(/^0+/, '');
    hms = hms.startsWith(':') ? hms.substr(1) : hms;
    return hms.startsWith('00') ? hms.substr(1) : hms;
}

export function iconUrl(icon) {
    return `https://fonts.gstatic.com/s/i/materialicons/${icon}/v6/24px.svg?download=true`;
}

export async function nativeIcon(icon) {
    return await getNativeImage(iconUrl(icon));
}

export async function getNativeImage(url, dark = true) {
    if (!nativeImage.cache)
        nativeImage.cache = {};
    if (!nativeImage.cache[url]) {
        let {black, white} = await getSvgIcon(url);
        nativeImage.cache[url] = {
            black: nativeImage.createFromDataURL(black),
            white: nativeImage.createFromDataURL(white)
        };
    }
    return nativeImage.cache[url][dark ? 'white' : 'black'];
}

/**
 * @param url
 * @param {int} width
 * @param {int} height
 * @returns {Promise<string>}
 */
export async function getSvgIcon(url, width = 18, height = 18) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.src = url;
        img.crossOrigin = "anonymous";
        img.onload = () => {
            let canvas = document.createElement('canvas');
            let context = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;
            context.drawImage(img, 0, 0, width, height);
            let black = canvas.toDataURL();
            let imgData = context.getImageData(0, 0, img.width, img.height);
            for (let i = 0; i < imgData.data.length; i += 4) {
                imgData.data[i] = 255 - imgData.data[i];
                imgData.data[i + 1] = 255 - imgData.data[i + 1];
                imgData.data[i + 2] = 255 - imgData.data[i + 2];
            }
            context.putImageData(imgData, 0, 0);
            let white = canvas.toDataURL();
            resolve({black, white});
        }
        img.onerror = reject;
    })
}
