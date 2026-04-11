#!/usr/bin/env python3
import argparse
import json
import mimetypes
import os
import sys
import uuid
from pathlib import Path
from typing import Dict, Tuple
from urllib import parse, request


API_ROOT = "https://api.weixin.qq.com/cgi-bin"


def http_json(url: str, *, data: bytes | None = None, headers: Dict[str, str] | None = None) -> dict:
    req = request.Request(url, data=data, headers=headers or {})
    with request.urlopen(req, timeout=60) as resp:
        body = resp.read()
    return json.loads(body.decode("utf-8"))


def http_multipart(url: str, file_path: Path, field_name: str = "media") -> dict:
    boundary = f"----CodexBoundary{uuid.uuid4().hex}"
    file_bytes = file_path.read_bytes()
    content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"

    parts = [
        f"--{boundary}\r\n".encode("utf-8"),
        (
            f'Content-Disposition: form-data; name="{field_name}"; filename="{file_path.name}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode("utf-8"),
        file_bytes,
        f"\r\n--{boundary}--\r\n".encode("utf-8"),
    ]
    body = b"".join(parts)
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    return http_json(url, data=body, headers=headers)


def get_access_token(appid: str, appsecret: str) -> str:
    query = parse.urlencode(
        {"grant_type": "client_credential", "appid": appid, "secret": appsecret}
    )
    data = http_json(f"{API_ROOT}/token?{query}")
    if "access_token" not in data:
        raise RuntimeError(f"token failed: {data}")
    return data["access_token"]


def upload_cover(token: str, cover_path: Path) -> str:
    url = f"{API_ROOT}/material/add_material?access_token={parse.quote(token)}&type=image"
    data = http_multipart(url, cover_path)
    if "media_id" not in data:
        raise RuntimeError(f"cover upload failed: {data}")
    return data["media_id"]


def upload_inline(token: str, image_path: Path) -> str:
    url = f"{API_ROOT}/media/uploadimg?access_token={parse.quote(token)}"
    data = http_multipart(url, image_path)
    if "url" not in data:
        raise RuntimeError(f"inline image upload failed: {data}")
    return data["url"]


def load_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def add_draft(token: str, article: dict) -> str:
    url = f"{API_ROOT}/draft/add?access_token={parse.quote(token)}"
    body = json.dumps({"articles": [article]}, ensure_ascii=False).encode("utf-8")
    data = http_json(
        url,
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    if "media_id" not in data:
        raise RuntimeError(f"draft add failed: {data}")
    return data["media_id"]


def get_draft(token: str, media_id: str) -> dict:
    url = f"{API_ROOT}/draft/get?access_token={parse.quote(token)}"
    body = json.dumps({"media_id": media_id}, ensure_ascii=False).encode("utf-8")
    return http_json(
        url,
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )


def parse_replace_pair(pair: str) -> Tuple[str, Path]:
    if "=" not in pair:
        raise argparse.ArgumentTypeError("expected PLACEHOLDER=/path/to/file.png")
    placeholder, path = pair.split("=", 1)
    return placeholder, Path(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a WeChat draft with uploaded images.")
    parser.add_argument("--meta", required=True, help="Path to meta.json")
    parser.add_argument("--content", required=True, help="Path to article HTML")
    parser.add_argument("--cover", required=True, help="Path to cover image")
    parser.add_argument(
        "--inline",
        action="append",
        default=[],
        help="Repeated PLACEHOLDER=/path/to/image.png pairs for inline images",
    )
    args = parser.parse_args()

    appid = os.environ.get("WECHAT_APPID")
    appsecret = os.environ.get("WECHAT_APPSECRET")
    if not appid or not appsecret:
        raise RuntimeError("WECHAT_APPID and WECHAT_APPSECRET must be set in the environment")

    meta_path = Path(args.meta)
    content_path = Path(args.content)
    cover_path = Path(args.cover)

    meta = json.loads(load_text(meta_path))
    content = load_text(content_path)

    token = get_access_token(appid, appsecret)
    thumb_media_id = upload_cover(token, cover_path)

    replacements: Dict[str, str] = {}
    for pair in args.inline:
        placeholder, image_path = parse_replace_pair(pair)
        replacements[placeholder] = upload_inline(token, image_path)

    for placeholder, url in replacements.items():
        content = content.replace(placeholder, url)

    article = {
        "title": meta["title"],
        "author": meta.get("author", ""),
        "digest": meta.get("digest", ""),
        "content": content,
        "content_source_url": meta.get("content_source_url", ""),
        "thumb_media_id": thumb_media_id,
        "need_open_comment": 0,
        "only_fans_can_comment": 0,
    }

    media_id = add_draft(token, article)
    draft = get_draft(token, media_id)
    item = draft.get("news_item", [{}])[0]

    print(json.dumps({
        "media_id": media_id,
        "title": item.get("title", ""),
        "digest": item.get("digest", ""),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
