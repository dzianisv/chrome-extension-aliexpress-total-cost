const PLUGIN_NAME = "AliexpressDelivery";

window.addEventListener("load", (event) => {
    iterateOverItems();
});

async function iterateOverItems() {
    // Iterate over all the links using a for loop
    const links = document.querySelectorAll('a[href*="aliexpress.ru/item/"]');
    const currency = getCurrency();

    console.log(PLUGIN_NAME, "currency", currency);

    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        // Extract productId and skuId from the link's href attribute
        const href = link.getAttribute('href');
        const productIdMatch = href.match(/item\/(\d+)\.html/);
        const skuIdMatch = href.match(/sku_id=(\d+)/);

        if (productIdMatch && skuIdMatch) {
            const productId = productIdMatch[1];
            const skuId = skuIdMatch[1];
            const price = findPrice(link, currency);
            
            console.log(PLUGIN_NAME, productId, skuId, price);
            const itemPlaceholder = document.createElement('div');
            link.appendChild(itemPlaceholder);
            
            if (price === null) {
                console.log(PLUGIN_NAME, `🚧 failed to get ${productId} price`);
                continue;
            }

            const deliveryPrice = await getDeliveryCost(productId, skuId, price, currency);
            if (deliveryPrice === null) {
                itemPlaceholder.innerText = "🚧 failed to get a delivery price";
            } else {
                const fullPrice = (deliveryPrice + price).toFixed(2);
                itemPlaceholder.innerText = `🚚 ${deliveryPrice} ${currency}\nTotal: ${fullPrice} ${currency}`;
            }
        }
    }
}

async function getDeliveryCost(productId, skuId, price, currency) {
    for (const p3 of ["USD", "CNY"]) {
        const r = await fetchDeliveryCost(productId, skuId, price, currency, p3);
        if (r != null) {
            return r;
        }
    }

    return null;
}

async function fetchDeliveryCost(productId, skuId, price, currency, p3 = "USD", /* USD or CNY */) {
    const requestBody = {
        "productId": productId,
        "productIdV2": productId.toString(),
        "sendGoodsCountry": "CN",
        "country": "BY",
        "provinceCode": getCookieValue("provice"), /* stored in cookie */
        "cityCode": getCookieValue("city"), /* stored in cookie */
        "skuId": skuId.toString(),
        "count": 1,
        "minPrice": price,
        // "maxPrice": 23.88,
        "tradeCurrency": currency,
        "displayMultipleFreight": false,
        "ext": {
            "p0": skuId.toString(),
            "p1": price.toString(),
            "p3": p3,
            "p4": "990000",
            "p5": "0",
            "p7": "{}",
            "hideShipFrom": "false"
        }, "sourceId": "0"
    };

    const response = await fetch(`https://aliexpress.ru/aer-api/bl/logistics/freight?product_id=${productId}&sourceId=0`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        mode: 'cors',
        credentials: 'include'
    });
    const data = await response.json();
    console.log(PLUGIN_NAME, productId, data);
    if (data.methods.length < 1) {
        return null;
    }
    
    const deliveryPrice = data.methods[0].amount.value;
    return deliveryPrice;
}

const currencyMappings = {
    "USD": "US $"
};

function findPrice(element, currency) {
    if (currencyMappings[currency]) {
        currency = currencyMappings[currency];
    }

    if (element.tagName === 'SPAN') {
        console.log(PLUGIN_NAME, element.innerText);

        if (element.innerText.includes(currency)) {
            const priceStr = element.innerText.replace(currency, '').replace(",", ".").trim();
            const price = parseFloat(priceStr);
            return price;
        } else {
            return null;
        }
    }

    // Iterate over the child nodes of the current element
    const children = element.childNodes;
    for (const child of children) {
        const r = findPrice(child, currency);
        if (r) {
            return r;
        }
    }
    
    return null;
}


function getCookieValue(cookieName) {
    var name = cookieName + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var cookieArray = decodedCookie.split(';');
  
    for (var i = 0; i < cookieArray.length; i++) {
      var cookie = cookieArray[i];
      while (cookie.charAt(0) === ' ') {
        cookie = cookie.substring(1);
      }
      if (cookie.indexOf(name) === 0) {
        return cookie.substring(name.length, cookie.length);
      }
    }
    return "";
  }
  
function getCurrency() {
    // Define the regular expression pattern to find the c_tp=key
    const pattern = /c_tp=([A-Z]{3})/;
    // Use the match method to find the pattern
    const match = document.cookie.match(pattern);
    // If a match is found, return the currency; otherwise, return null
    return match ? match[1].trim() : null;
  }