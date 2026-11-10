import os
import requests

url = "https://live-mt-server.wati.io/api/ext/v3/conversations/messages/text"

headers = {
    "Authorization": f"Bearer wati_ac8a3fcd-38b7-4701-bfe7-574c952fb709.8FAp4BGu6JgmuuHP6Ex1zM4J_kQ_GLticeSidFwIrqzwOBLPyzEFPzIgCUHYQ0dYP5ygVE4F47wVktI2Kdq80cuNCROGJiNjL5NNNCzi_Rtm3NgCRYc2Zc3JOgJ5a9mQ",
    "Content-Type": "application/json"
}

payload = {
    "target": "2349020000080",
    "text": "Hi from MubaXpress using the Wati API"
}

res = requests.post(
    url,
    headers=headers,
    json=payload,
    timeout=30
)

print("Status:", res.status_code)
print("Response:", res.text)