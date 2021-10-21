const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');
const readline = require('readline');

(async () => {
    console.log('puppeteer Instagram Saver1.1');
    console.log('Author: Nakateru(2021.10.21)');

    // var instaUrl = 'https://www.instagram.com/p/CUh1PeevrIV/';
    // var instaUrl = 'https://www.instagram.com/tv/CUhvuM8M47Y/';
    // var instaUrl = 'https://www.instagram.com/p/CVSp7gQPRMr/';
    // var instaUrl = 'https://www.instagram.com/p/CVSmeC7vAsU/';

    //Cannot Open
    //var  url = 'https://www.instagram.com/reel/CSESrYKJg2E/';

    //input instagram url
    var instaUrl = await inputUrl();

    //open	browser
    const browser = await puppeteer.launch({
        headless: false,
        ignoreHTTPSErrors: true,
        args: ['--lang=ja'],
        defaultViewport: {width: 800, height: 600}
    });

    const page = await browser.newPage();
    await page.goto(instaUrl);

    //get user name
    const title = await page.title();
    //console.log(title);
    const username = title.match(/(.+)(はInstagram|の動画|がInstagram|のInstagram)/)[1];
    console.log('User Name: ' + username);

    //get post time
    const isoTime = await page.$eval('time[class="_1o9PC Nzb55"]', ele => ele.getAttribute('datetime'));
    const newDateIsoTime = new Date(isoTime);
    console.log('Post Time: ' + newDateIsoTime.toString());

    //set file name
    var jstTime = newDateIsoTime.toLocaleString('ja-JP');
    //console.log(jstTime);
    if (newDateIsoTime.getMonth() < 9) {
        jstTime = newDateIsoTime.toLocaleString().replace(/\//, '-0');
        jstTime = jstTime.replace(/\//, '-');
    } else {
        jstTime = newDateIsoTime.toLocaleString().replace(/\//g, '-');
    }
    if (newDateIsoTime.getHours() < 10) {
        jstTime = jstTime.toLocaleString().replace(' ', ' 0');
        jstTime = jstTime.toLocaleString().replace(/:/g, '');
    } else {
        jstTime = jstTime.toLocaleString().replace(/:/g, '');
    }
    // console.log(jstTime);

    //get json content
    instaUrl = instaUrl + '?__a=1';
    await page.goto(instaUrl);

    const content = await page.$eval('pre', element => element.textContent);
    // console.log(content);

    //close browser
    await browser.close();

    //parse json and get image or vide url
    const res = parseJson(content);
    // console.log(res);
    const mediaArr = Array.isArray(res) ? res : [res]
    console.log('Media URL:');
    mediaArr.map(x => console.log(x));

    //set path name
    const pathName = username.replace(/[\\:*?"<>|/]/g, "") + '_Instagram';

    //create directory
    await mkdirFun(pathName);

    //save image file
    try {
        var num = 1;
        await mediaArr.map(x => {
            saveMedia(pathName + '/' + jstTime + ' ' + num, x);
            num++;
        });
    } catch (err) {
        console.log(err.message);
    } finally {
        console.log('Done!');
    }

    //---------------------Function------------------------------------
    //input url function
    function inputUrl() {
        const reader = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise((resolve, reject) => {
            reader.question('Input Instagram URL:', url => {
                if (!url.endsWith('/')) {
                    url = url + '/';
                }
                const re = url.match(/www.instagram.com\/(tv|p)\/[a-zA-Z0-9-_]{11}\/$/);
                if (re === null) {
                    console.log('ERROR URL!');
                    process.exit();
                } else {
                    console.log('Inputed URL: ' + url);
                    resolve(url);
                    reader.close();
                }
            });
        });
    }

    //parse JSON function
    function parseJson(content) {
        const str = JSON.parse(content);

        //more than 1 image, or image(s) and video(s) [return Array]
        if (str.graphql.shortcode_media.edge_sidecar_to_children !== undefined) {
            //image(s) and video(s)
            var arr = [];
            str.graphql.shortcode_media.edge_sidecar_to_children.edges.map(x => {
                x.node.is_video ? arr.push(x.node.video_url) : arr.push(x.node.display_url);
            });
            return arr;
            //only 1 video [return string]
        } else if (str.graphql.shortcode_media.is_video) {
            return str.graphql.shortcode_media.video_url;
            //only 1 image [return string]
        } else {
            return str.graphql.shortcode_media.display_url;
        }

    }

    //save images or video function
    function saveMedia(path, mediaUrl) {
        https.get(mediaUrl, res => {
            //console.log(res.headers);
            //get media type
            const contentType = res.headers['content-type'];
            //console.log(contentType);
            var mediaType = '.jpg';
            if (contentType === 'image/jpeg') {
                mediaType = '.jpg';
            } else if (contentType === 'image/gif') {
                mediaType = '.gif';
            } else if (contentType === 'image/png') {
                mediaType = '.png';
            } else if (contentType === 'video/mp4') {
                mediaType = '.mp4';
            }
            //set file name
            const mediaName = path + mediaType;
            //write file
            const stream = fs.createWriteStream(mediaName);
            res.pipe(stream);
            stream.on('finish', () => {
                stream.close();
                console.log('saved ' + mediaName);
            });

        });
    }

    //create directory function
    function mkdirFun(path) {
        const isExists = fs.existsSync(path);
        if (!isExists) {
            try {
                fs.mkdirSync(path, {recursive: true});
                console.log('Created Folder ' + path);
            } catch {
                console.log('Created Folder Failed');
            }
        } else {
            console.log('Directory Existed!');
        }
    }
})();