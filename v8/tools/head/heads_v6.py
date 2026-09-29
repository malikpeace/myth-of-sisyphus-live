from headart import *
XL = [
"...hHHhh...",
"..hHhhhhh..",
".hhhhhhhhh.",
"hhhhhhhssS.",
"hhhhhssSkS.",
"hhhhbssseS.",
"hhhlbbssssS",
".hhlbbssbbs",
".lhlsbbsmbb",
"..ll.bbbbb.",
".....bbb...",
]
L = [
"..hHHhh...",
".hhhhhhh..",
"hhhhhssS..",
"hhhhssSkS.",
"hhhbssseS.",
"hhlbbssssS",
".hlbsssbb.",
".lhsbbsmb.",
"..l.bbbb..",
]
M = [
"..hHhh..",
".hhhhhh.",
"hhhhssS.",
"hhhbsseS",
"hhlbbssS",
".lhsbbbb",
"...bbbb.",
]
S_ = [
".hHhh.",
"hhhhsS",
"hhbseS",
"hlbssS",
".lbbbb",
"..bbb.",
]
XS = [
".hh.",
"hhsS",
"hbse",
".bbb",
]
for n, r in (("XL", XL), ("L", L), ("M", M), ("S", S_), ("XS", XS)):
    assert len(set(len(x) for x in r)) == 1, (n, [len(x) for x in r])
sheet([("XL", XL), ("L", L), ("M", M), ("S", S_), ("XS", XS)], "v6.png", 12)
