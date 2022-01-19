const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const https = require('https');
const prompts = require('prompts');
puppeteer.use(StealthPlugin());

(async () => {
    console.log('puppeteer Instagram Saver1.3.1');
    console.log('Author: Nakateru(2022.1.20)');

    //input instagram url
    const inputted = await prompts({
        type: 'text',
        name: 'url',
        message: 'Please Input Instagram URL:'
    });
    var instaUrl = analyzeUrl(inputted.url);

    console.time('Processing time');

    //open	browser
    const browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        args: ['--lang=en'],
        defaultViewport: {width: 800, height: 600}
    });

    //create new page
    const page = await browser.newPage();

    //(2)read cookie file(*)
    const cookies = JSON.parse(fs.readFileSync('./puppeteer.cookie', 'utf-8'));
    for (let cookie of cookies) {
        await page.setCookie(cookie);
    }

    //go to page
    await page.goto(instaUrl, {
        waitUntil: 'load',
        timeout: 0
    });

    //(1)if you login more than 3 times a day or save reel ,please create your cookies and load it (*)
    //input your USERNAME and PASSWORD
/*    await page.waitForSelector('#loginForm', {visible: true});
    await page.type('input[aria-label="Phone number, username, or email"]', 'USERNAME');
    await page.type('input[aria-label="Password"]', 'PASSWORD');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({timeout: 60000, waitUntil: 'domcontentloaded'});
    //create cookies file
    const createdCookies = await page.cookies();
    fs.writeFileSync('./puppeteer.cookie', JSON.stringify(createdCookies));*/

	//screenshot(for test)
    // await page.screenshot({ path: 'testresult.png', fullPage: true });
	
    //get user name
    const title = await page.title();
    //console.log(title);

    let username = /(?<= photo by )(.+)(?= • )/.exec(title);
    if (username === null){
        username = /(.+)(?= on)/.exec(title)[1];
    }else{
        username = username[1];
    }
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
        console.timeEnd('Processing time');
    }

    //---------------------Function------------------------------------
    //analyze url function
    function analyzeUrl(url) {
        if (!url.endsWith('/')) {
            url = url + '/';
        }
        const re = url.match(/www.instagram.com\/(tv|p|reel)\/[a-zA-Z0-9-_]{11}\/$/);
        if (re === null) {
            console.log('ERROR URL!');
            process.exit();
        }
        return url;
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