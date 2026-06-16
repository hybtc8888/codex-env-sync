import io
import unittest

from stdio_utils import configure_utf8_stdio


class FakeTextStream(io.StringIO):
    def __init__(self):
        super().__init__()
        self.encoding_value = "gbk"
        self.reconfigured_to = None

    @property
    def encoding(self):
        return self.encoding_value

    def reconfigure(self, encoding=None):
        self.reconfigured_to = encoding
        self.encoding_value = encoding


class Utf8StdioTest(unittest.TestCase):
    def test_reconfigures_non_utf8_streams(self):
        stream = FakeTextStream()

        configure_utf8_stdio(stream)

        self.assertEqual(stream.reconfigured_to, "utf-8")


if __name__ == "__main__":
    unittest.main()
