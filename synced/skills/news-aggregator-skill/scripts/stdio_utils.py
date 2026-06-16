import sys


def configure_utf8_stdio(stream=None):
    stream = stream or sys.stdout
    reconfigure = getattr(stream, "reconfigure", None)
    encoding = (getattr(stream, "encoding", "") or "").lower()
    if callable(reconfigure) and encoding != "utf-8":
        reconfigure(encoding="utf-8")


def configure_utf8_output():
    configure_utf8_stdio(sys.stdout)
    configure_utf8_stdio(sys.stderr)
