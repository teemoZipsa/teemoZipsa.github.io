import urllib.request
import xml.etree.ElementTree as ET
import json
import os
from datetime import datetime

# Google Trends RSS URL for South Korea
RSS_URL = "https://trends.google.com/trending/rss?geo=KR"
OUTPUT_FILE = "blog/data/trends.json"

def fetch_trends():
    try:
        req = urllib.request.Request(RSS_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        
        items = []
        # Find all 'item' elements in the RSS channel
        for item in root.findall('./channel/item')[:10]: # Top 10
            title = item.find('title').text
            
            # The approximate traffic (e.g., "100K+")
            approx_traffic_el = item.find('{https://trends.google.com/trends/trendingsearches/daily}approx_traffic')
            traffic = approx_traffic_el.text if approx_traffic_el is not None else ""
            
            items.append({
                "keyword": title,
                "category": traffic,
                "timestamp": datetime.now().isoformat()
            })
            
        output_data = {
            "last_updated": datetime.now().isoformat(),
            "items": items
        }
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully fetched {len(items)} trends and saved to {OUTPUT_FILE}")
        
    except Exception as e:
        print(f"Error fetching trends: {e}")
        exit(1)

if __name__ == "__main__":
    fetch_trends()
