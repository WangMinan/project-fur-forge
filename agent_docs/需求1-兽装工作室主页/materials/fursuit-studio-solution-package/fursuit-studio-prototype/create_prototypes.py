from pathlib import Path
import cairosvg

OUT = Path('/mnt/data/fursuit-studio-prototype')

client_svg = r'''<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000" viewBox="0 0 1440 1000">
  <defs>
    <linearGradient id="heroA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#202638"/>
      <stop offset="0.55" stop-color="#5A6DFF"/>
      <stop offset="1" stop-color="#C9FF5A"/>
    </linearGradient>
    <linearGradient id="photoB" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F6B37C"/>
      <stop offset="1" stop-color="#D94C64"/>
    </linearGradient>
    <linearGradient id="photoC" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#BFD7FF"/>
      <stop offset="1" stop-color="#2455C3"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#111318" flood-opacity="0.12"/>
    </filter>
    <pattern id="grain" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="2" r="0.7" fill="#fff" opacity="0.12"/>
      <circle cx="6" cy="5" r="0.5" fill="#111318" opacity="0.08"/>
    </pattern>
  </defs>

  <rect width="1440" height="1000" fill="#F4F2ED"/>

  <!-- Header -->
  <rect x="0" y="0" width="1440" height="88" fill="#F4F2ED"/>
  <line x1="48" y1="87.5" x2="1392" y2="87.5" stroke="#D7D5CF"/>
  <g transform="translate(48 24)">
    <rect x="0" y="0" width="40" height="40" rx="11" fill="#111318"/>
    <path d="M10 28 L20 9 L30 28 L25 24 L20 31 L15 24 Z" fill="#C9FF5A"/>
    <text x="56" y="25" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="750" fill="#111318" letter-spacing="1.2">NORTHWIND</text>
    <text x="56" y="40" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="#747880" letter-spacing="2.2">FURSUIT STUDIO</text>
  </g>
  <g font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="14" font-weight="600" fill="#343842">
    <text x="760" y="53">首页</text>
    <text x="840" y="53">作品</text>
    <text x="920" y="53">委托说明</text>
    <text x="1028" y="53">动态</text>
    <text x="1108" y="53">关于我们</text>
  </g>
  <rect x="1250" y="25" width="142" height="40" rx="20" fill="#111318"/>
  <text x="1321" y="51" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="14" font-weight="700" fill="#FFFFFF">提交委托意向</text>

  <!-- Hero copy -->
  <g transform="translate(64 154)">
    <rect x="0" y="0" width="126" height="31" rx="15.5" fill="#E8E6DF"/>
    <circle cx="17" cy="15.5" r="5" fill="#4F65FF"/>
    <text x="31" y="21" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" font-weight="700" fill="#30343C">2026 秋季档开放</text>

    <text x="0" y="106" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="72" font-weight="800" fill="#111318">让角色</text>
    <text x="0" y="184" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="72" font-weight="800" fill="#111318">走出设定。</text>
    <path d="M6 205 C150 185 250 218 388 195" stroke="#4F65FF" stroke-width="6" fill="none" stroke-linecap="round"/>

    <text x="0" y="260" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="18" fill="#5E636D">以清晰的角色表达、耐看的结构与稳定的穿着体验，</text>
    <text x="0" y="290" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="18" fill="#5E636D">完成从设定图到现实角色的完整转译。</text>

    <rect x="0" y="334" width="168" height="52" rx="26" fill="#111318"/>
    <text x="84" y="367" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="15" font-weight="700" fill="#FFFFFF">浏览精选作品</text>
    <rect x="182" y="334" width="144" height="52" rx="26" fill="none" stroke="#A8A7A1"/>
    <text x="254" y="367" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="15" font-weight="700" fill="#30343C">了解委托流程</text>

    <g transform="translate(0 430)">
      <text x="0" y="0" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#9B9C9F" letter-spacing="1.5">FOCUS</text>
      <text x="0" y="32" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="14" font-weight="650" fill="#3E424A">角色识别度</text>
      <text x="100" y="32" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="14" font-weight="650" fill="#3E424A">结构舒适度</text>
      <text x="216" y="32" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="14" font-weight="650" fill="#3E424A">镜头表现力</text>
    </g>
  </g>

  <!-- Hero visual -->
  <g transform="translate(610 126)">
    <rect x="54" y="20" width="706" height="516" rx="28" fill="url(#heroA)" filter="url(#shadow)"/>
    <rect x="54" y="20" width="706" height="516" rx="28" fill="url(#grain)"/>
    <circle cx="512" cy="140" r="126" fill="#FFFFFF" opacity="0.12"/>
    <circle cx="190" cy="430" r="180" fill="#C9FF5A" opacity="0.16"/>
    <path d="M354 96 C300 150 290 220 316 280 C280 312 276 390 314 446 C355 504 454 500 502 446 C540 403 538 324 504 284 C536 218 518 146 460 98 C432 74 382 72 354 96 Z" fill="#111318" opacity="0.80"/>
    <path d="M332 130 L310 56 L372 104 Z" fill="#111318" opacity="0.88"/>
    <path d="M486 130 L516 54 L448 104 Z" fill="#111318" opacity="0.88"/>
    <ellipse cx="408" cy="230" rx="92" ry="84" fill="#F4F2ED" opacity="0.94"/>
    <ellipse cx="376" cy="217" rx="17" ry="24" fill="#4F65FF"/>
    <ellipse cx="444" cy="217" rx="17" ry="24" fill="#C9FF5A"/>
    <path d="M401 250 Q408 260 415 250" stroke="#111318" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M392 276 Q408 288 425 276" stroke="#111318" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M354 320 C370 300 448 300 466 320 L500 456 L316 456 Z" fill="#F4F2ED" opacity="0.94"/>
    <path d="M342 338 L286 414" stroke="#111318" stroke-width="34" stroke-linecap="round"/>
    <path d="M474 338 L540 408" stroke="#111318" stroke-width="34" stroke-linecap="round"/>
    <text x="82" y="58" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#FFFFFF" letter-spacing="2">FEATURED CHARACTER / 014</text>
    <g transform="translate(82 450)">
      <text x="0" y="0" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="26" font-weight="750" fill="#FFFFFF">霁野 · 全装委托</text>
      <text x="0" y="30" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="600" fill="#FFFFFF" opacity="0.76" letter-spacing="1.6">WOLF / FULLSUIT / 2026</text>
    </g>
    <rect x="640" y="440" width="80" height="52" rx="26" fill="#FFFFFF" opacity="0.94"/>
    <text x="680" y="472" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#111318">↗</text>
  </g>

  <!-- Selected works -->
  <g transform="translate(48 720)">
    <text x="0" y="0" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#9A9B9E" letter-spacing="2">SELECTED WORKS</text>
    <text x="0" y="48" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="34" font-weight="780" fill="#111318">近期完成的角色</text>
    <text x="1180" y="45" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="14" font-weight="700" fill="#4F65FF">查看全部作品  →</text>

    <g transform="translate(0 80)">
      <rect x="0" y="0" width="420" height="160" rx="18" fill="url(#photoB)"/>
      <rect x="18" y="18" width="92" height="26" rx="13" fill="#FFFFFF" opacity="0.90"/>
      <text x="64" y="36" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" font-weight="700" fill="#111318">全装 / 狐</text>
      <text x="24" y="126" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="21" font-weight="750" fill="#FFFFFF">绯橙</text>
      <text x="24" y="148" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="600" fill="#FFFFFF" opacity="0.8" letter-spacing="1.4">CUSTOM SERIES 012</text>
    </g>
    <g transform="translate(444 80)">
      <rect x="0" y="0" width="420" height="160" rx="18" fill="url(#photoC)"/>
      <rect x="18" y="18" width="104" height="26" rx="13" fill="#FFFFFF" opacity="0.90"/>
      <text x="70" y="36" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" font-weight="700" fill="#111318">半装 / 龙</text>
      <text x="24" y="126" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="21" font-weight="750" fill="#FFFFFF">潮汐脊</text>
      <text x="24" y="148" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="600" fill="#FFFFFF" opacity="0.8" letter-spacing="1.4">ORIGINAL SERIES 006</text>
    </g>
    <g transform="translate(888 80)">
      <rect x="0" y="0" width="420" height="160" rx="18" fill="#252A35"/>
      <circle cx="316" cy="52" r="86" fill="#C9FF5A" opacity="0.26"/>
      <circle cx="105" cy="138" r="90" fill="#4F65FF" opacity="0.45"/>
      <rect x="18" y="18" width="104" height="26" rx="13" fill="#FFFFFF" opacity="0.90"/>
      <text x="70" y="36" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" font-weight="700" fill="#111318">单头 / 猫</text>
      <text x="24" y="126" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="21" font-weight="750" fill="#FFFFFF">暮星</text>
      <text x="24" y="148" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="600" fill="#FFFFFF" opacity="0.8" letter-spacing="1.4">CUSTOM SERIES 009</text>
    </g>
  </g>

  <text x="1392" y="980" text-anchor="end" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" fill="#A1A19D">概念原型 · 客户端首页 · 1440px</text>
</svg>'''

admin_svg = r'''<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000" viewBox="0 0 1440 1000">
  <defs>
    <linearGradient id="preview" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#202638"/>
      <stop offset="0.58" stop-color="#5A6DFF"/>
      <stop offset="1" stop-color="#C9FF5A"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="7" stdDeviation="12" flood-color="#1A1D25" flood-opacity="0.08"/>
    </filter>
  </defs>

  <rect width="1440" height="1000" fill="#F3F4F6"/>

  <!-- Sidebar -->
  <rect x="0" y="0" width="236" height="1000" fill="#151821"/>
  <g transform="translate(24 24)">
    <rect x="0" y="0" width="36" height="36" rx="10" fill="#C9FF5A"/>
    <path d="M9 26 L18 8 L27 26 L23 22 L18 28 L13 22 Z" fill="#151821"/>
    <text x="50" y="22" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="750" fill="#FFFFFF" letter-spacing="0.8">NORTHWIND</text>
    <text x="50" y="36" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="9" font-weight="650" fill="#777D8C" letter-spacing="1.2">内容管理后台</text>
  </g>

  <g font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="14" font-weight="600">
    <text x="24" y="104" fill="#666C7A" font-size="10" letter-spacing="1.5">WORKSPACE</text>
    <rect x="14" y="123" width="208" height="44" rx="10" fill="#292E3A"/>
    <rect x="14" y="123" width="4" height="44" rx="2" fill="#C9FF5A"/>
    <circle cx="38" cy="145" r="7" fill="#C9FF5A" opacity="0.85"/>
    <text x="58" y="150" fill="#FFFFFF">作品管理</text>

    <circle cx="38" cy="194" r="7" fill="#697080"/>
    <text x="58" y="199" fill="#B5BAC6">首页内容</text>
    <circle cx="38" cy="243" r="7" fill="#697080"/>
    <text x="58" y="248" fill="#B5BAC6">委托说明</text>
    <circle cx="38" cy="292" r="7" fill="#697080"/>
    <text x="58" y="297" fill="#B5BAC6">动态公告</text>
    <circle cx="38" cy="341" r="7" fill="#697080"/>
    <text x="58" y="346" fill="#B5BAC6">媒体资源</text>
    <circle cx="38" cy="390" r="7" fill="#697080"/>
    <text x="58" y="395" fill="#B5BAC6">站点设置</text>
  </g>

  <g transform="translate(20 894)">
    <rect x="0" y="0" width="196" height="74" rx="14" fill="#20242F"/>
    <circle cx="28" cy="28" r="16" fill="#4F65FF"/>
    <text x="28" y="33" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="800" fill="#FFFFFF">A</text>
    <text x="54" y="25" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" font-weight="700" fill="#FFFFFF">管理员</text>
    <text x="54" y="43" font-family="Inter, Arial, sans-serif" font-size="10" fill="#838A99">admin@studio</text>
    <text x="176" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#747B8A">⋯</text>
  </g>

  <!-- Topbar -->
  <rect x="236" y="0" width="1204" height="76" fill="#FFFFFF"/>
  <line x1="236" y1="75.5" x2="1440" y2="75.5" stroke="#E3E5E9"/>
  <g transform="translate(268 22)">
    <text x="0" y="15" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" fill="#8B9099">作品管理</text>
    <text x="72" y="15" font-family="Arial, sans-serif" font-size="13" fill="#C2C5CB">/</text>
    <text x="88" y="15" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" font-weight="650" fill="#252932">编辑作品</text>
  </g>
  <rect x="1104" y="18" width="92" height="40" rx="10" fill="#FFFFFF" stroke="#D9DCE2"/>
  <text x="1150" y="43" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" font-weight="700" fill="#3A3E47">保存草稿</text>
  <rect x="1208" y="18" width="96" height="40" rx="10" fill="#151821"/>
  <text x="1256" y="43" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" font-weight="700" fill="#FFFFFF">发布作品</text>
  <rect x="1316" y="18" width="92" height="40" rx="10" fill="#F0F1F4"/>
  <text x="1362" y="43" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" font-weight="700" fill="#4F5561">预览 ↗</text>

  <!-- Main header -->
  <g transform="translate(268 108)">
    <text x="0" y="0" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="28" font-weight="780" fill="#171A21">编辑作品</text>
    <text x="0" y="31" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" fill="#858A94">作品编号 W-0014 · 最近保存于 2 分钟前</text>
    <rect x="1092" y="-18" width="74" height="28" rx="14" fill="#FFF5D8"/>
    <circle cx="1108" cy="-4" r="4" fill="#E6A10C"/>
    <text x="1120" y="1" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" font-weight="700" fill="#7E5B0F">草稿</text>
  </g>

  <!-- Form column -->
  <g transform="translate(268 176)">
    <rect x="0" y="0" width="720" height="760" rx="16" fill="#FFFFFF" filter="url(#soft)"/>
    <text x="24" y="38" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="16" font-weight="750" fill="#22262E">基础信息</text>
    <line x1="24" y1="56" x2="696" y2="56" stroke="#E8E9EC"/>

    <text x="24" y="88" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" font-weight="650" fill="#545A65">作品名称 *</text>
    <rect x="24" y="102" width="324" height="42" rx="9" fill="#FFFFFF" stroke="#D7DAE0"/>
    <text x="38" y="128" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" fill="#242830">霁野</text>
    <text x="372" y="88" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" font-weight="650" fill="#545A65">页面路径 *</text>
    <rect x="372" y="102" width="324" height="42" rx="9" fill="#FFFFFF" stroke="#D7DAE0"/>
    <text x="386" y="128" font-family="Inter, Arial, sans-serif" font-size="12" fill="#242830">ji-ye</text>

    <text x="24" y="178" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" font-weight="650" fill="#545A65">系列</text>
    <rect x="24" y="192" width="210" height="42" rx="9" fill="#FFFFFF" stroke="#D7DAE0"/>
    <text x="38" y="218" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" fill="#242830">定制系列</text>
    <text x="218" y="218" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#90959F">⌄</text>
    <text x="255" y="178" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" font-weight="650" fill="#545A65">类型</text>
    <rect x="255" y="192" width="210" height="42" rx="9" fill="#FFFFFF" stroke="#D7DAE0"/>
    <text x="269" y="218" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" fill="#242830">全装</text>
    <text x="449" y="218" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#90959F">⌄</text>
    <text x="486" y="178" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" font-weight="650" fill="#545A65">物种</text>
    <rect x="486" y="192" width="210" height="42" rx="9" fill="#FFFFFF" stroke="#D7DAE0"/>
    <text x="500" y="218" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" fill="#242830">狼</text>
    <text x="680" y="218" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#90959F">⌄</text>

    <text x="24" y="270" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" font-weight="650" fill="#545A65">作品摘要 *</text>
    <rect x="24" y="284" width="672" height="76" rx="9" fill="#FFFFFF" stroke="#D7DAE0"/>
    <text x="38" y="311" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" fill="#3A3F48">冷灰色狼型角色，以高辨识度眼部结构与蓝绿色点缀为核心，</text>
    <text x="38" y="334" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" fill="#3A3F48">兼顾舞台动作表现与长时间穿着体验。</text>
    <text x="670" y="348" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="10" fill="#A1A5AD">56 / 120</text>

    <text x="24" y="396" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" font-weight="650" fill="#545A65">作品说明</text>
    <rect x="24" y="410" width="672" height="142" rx="9" fill="#FFFFFF" stroke="#D7DAE0"/>
    <rect x="24" y="410" width="672" height="34" rx="9" fill="#F7F8FA"/>
    <g font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#666C76">
      <text x="40" y="432">B</text><text x="64" y="432">I</text><text x="86" y="432">U</text><text x="118" y="432">H2</text><text x="151" y="432">• List</text><text x="205" y="432">Link</text>
    </g>
    <text x="40" y="476" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" fill="#3A3F48">头部采用较收敛的轮廓，保留角色安静、警觉的气质；</text>
    <text x="40" y="500" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" fill="#3A3F48">四肢比例适合舞台动作，尾部使用轻量化支撑结构。</text>

    <text x="24" y="588" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="16" font-weight="750" fill="#22262E">媒体与排序</text>
    <line x1="24" y1="606" x2="696" y2="606" stroke="#E8E9EC"/>
    <rect x="24" y="626" width="672" height="112" rx="12" fill="#F8F9FB" stroke="#C9CDD5" stroke-dasharray="6 6"/>
    <circle cx="94" cy="682" r="26" fill="#E8EBF0"/>
    <text x="94" y="690" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#707782">＋</text>
    <text x="134" y="673" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" font-weight="700" fill="#30353E">拖拽图片到此处，或点击上传</text>
    <text x="134" y="697" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" fill="#8D929C">JPG / PNG / WebP，单张建议不超过 20 MB</text>
    <rect x="570" y="661" width="104" height="42" rx="9" fill="#FFFFFF" stroke="#D4D7DD"/>
    <text x="622" y="687" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" font-weight="700" fill="#3A3F48">选择文件</text>

    <g transform="translate(24 754)">
      <rect x="0" y="0" width="96" height="72" rx="9" fill="url(#preview)"/>
      <rect x="8" y="8" width="34" height="18" rx="9" fill="#C9FF5A"/>
      <text x="25" y="21" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="8" font-weight="700" fill="#151821">封面</text>
      <rect x="112" y="0" width="96" height="72" rx="9" fill="#EBC08B"/>
      <rect x="224" y="0" width="96" height="72" rx="9" fill="#AFCDFD"/>
      <rect x="336" y="0" width="96" height="72" rx="9" fill="#252A35"/>
      <rect x="448" y="0" width="96" height="72" rx="9" fill="#D7D9DE"/>
      <rect x="560" y="0" width="112" height="72" rx="9" fill="#F8F9FB" stroke="#D9DCE2"/>
      <text x="616" y="42" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" font-weight="700" fill="#676D78">管理 8 张图片</text>
    </g>
  </g>

  <!-- Preview column -->
  <g transform="translate(1012 176)">
    <rect x="0" y="0" width="396" height="760" rx="16" fill="#FFFFFF" filter="url(#soft)"/>
    <text x="22" y="36" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="15" font-weight="750" fill="#22262E">实时预览</text>
    <rect x="289" y="17" width="84" height="30" rx="15" fill="#F1F2F5"/>
    <text x="331" y="37" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" font-weight="700" fill="#555B66">桌面端  ⌄</text>
    <line x1="22" y1="58" x2="374" y2="58" stroke="#E8E9EC"/>

    <rect x="22" y="80" width="352" height="460" rx="16" fill="#F4F2ED" stroke="#E0E1E4"/>
    <rect x="38" y="96" width="320" height="278" rx="14" fill="url(#preview)"/>
    <circle cx="264" cy="165" r="72" fill="#FFFFFF" opacity="0.13"/>
    <path d="M174 138 C145 172 147 221 164 243 C148 268 152 321 184 341 C217 362 274 349 290 314 C304 283 295 254 280 239 C299 195 278 150 246 133 C225 122 191 123 174 138 Z" fill="#151821" opacity="0.82"/>
    <path d="M164 153 L153 106 L191 141 Z" fill="#151821"/>
    <path d="M259 151 L280 104 L239 139 Z" fill="#151821"/>
    <ellipse cx="218" cy="202" rx="52" ry="46" fill="#F4F2ED"/>
    <ellipse cx="199" cy="195" rx="10" ry="14" fill="#4F65FF"/>
    <ellipse cx="238" cy="195" rx="10" ry="14" fill="#C9FF5A"/>
    <text x="50" y="397" font-family="Inter, Arial, sans-serif" font-size="9" font-weight="700" fill="#8E9197" letter-spacing="1.4">CUSTOM SERIES / 014</text>
    <text x="50" y="430" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="28" font-weight="800" fill="#151821">霁野</text>
    <text x="50" y="454" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" fill="#686D76">狼 · 全装 · 2026</text>
    <text x="50" y="488" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" fill="#686D76">冷灰色狼型角色，以高辨识度眼部结构与</text>
    <text x="50" y="507" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" fill="#686D76">蓝绿色点缀为核心。</text>

    <rect x="22" y="560" width="352" height="72" rx="12" fill="#F7F8FA"/>
    <text x="38" y="584" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" font-weight="700" fill="#555B66">发布检查</text>
    <circle cx="42" cy="608" r="6" fill="#36B37E"/>
    <text x="55" y="612" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="10" fill="#6A707B">封面、摘要、分类和 8 张图片均已完成</text>

    <text x="22" y="673" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="12" font-weight="650" fill="#555B66">SEO 标题</text>
    <rect x="22" y="686" width="352" height="40" rx="8" fill="#FFFFFF" stroke="#D9DCE2"/>
    <text x="34" y="711" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" fill="#3D424B">霁野狼型兽装制作案例｜Northwind Studio</text>
  </g>

  <text x="1408" y="980" text-anchor="end" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="11" fill="#A1A5AD">概念原型 · 管理端作品编辑页 · 1440px</text>
</svg>'''

(OUT / 'client-home-concept.svg').write_text(client_svg, encoding='utf-8')
(OUT / 'admin-work-editor-concept.svg').write_text(admin_svg, encoding='utf-8')

for name in ['client-home-concept', 'admin-work-editor-concept']:
    cairosvg.svg2png(url=str(OUT / f'{name}.svg'), write_to=str(OUT / f'{name}.png'), output_width=1440, output_height=1000)

html = r'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>兽装工作室网站概念原型</title>
<style>
  :root{font-family:Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:#151821;background:#e9eaed}
  *{box-sizing:border-box} body{margin:0;padding:28px}.head{max-width:1440px;margin:0 auto 18px;display:flex;justify-content:space-between;align-items:end;gap:20px}.head h1{margin:0;font-size:24px}.head p{margin:6px 0 0;color:#676d78;font-size:14px}.tabs{display:flex;gap:8px}.tabs button{border:1px solid #cfd2d8;background:#fff;border-radius:999px;padding:9px 15px;font-weight:700;cursor:pointer}.tabs button.active{background:#151821;color:#fff;border-color:#151821}.board{max-width:1440px;margin:auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 15px 45px rgba(17,19,24,.12)}object{display:block;width:100%;height:auto;aspect-ratio:1.44}.note{max-width:1440px;margin:16px auto 0;color:#727780;font-size:13px;line-height:1.7}.hide{display:none}
</style>
</head>
<body>
<div class="head"><div><h1>兽装工作室网站概念原型</h1><p>客户端采用编辑型作品集语言；管理端采用高密度、低干扰的内容工具语言。</p></div><div class="tabs"><button class="active" data-target="client">客户端首页</button><button data-target="admin">管理端编辑页</button></div></div>
<div class="board" id="client"><object type="image/svg+xml" data="client-home-concept.svg"></object></div>
<div class="board hide" id="admin"><object type="image/svg+xml" data="admin-work-editor-concept.svg"></object></div>
<div class="note">这是一份方向性原型，不使用第三方工作室照片。两个 SVG 都可以直接拖入 Figma，作为可编辑矢量图层继续调整；正式设计时应替换为工作室 Logo、真实作品照片、品牌强调色和实际文案。</div>
<script>document.querySelectorAll('button[data-target]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.board').forEach(x=>x.classList.add('hide'));document.getElementById(b.dataset.target).classList.remove('hide')}))</script>
</body></html>'''
(OUT / 'prototype-preview.html').write_text(html, encoding='utf-8')

readme = '''# 兽装工作室网站概念原型

- `client-home-concept.svg`：客户端首页，1440×1000，可直接导入 Figma。
- `admin-work-editor-concept.svg`：管理端作品编辑页，1440×1000，可直接导入 Figma。
- `prototype-preview.html`：本地浏览两个界面。
- 对应 PNG 文件用于快速预览。

这是一份方向性低/中保真原型，图片使用抽象占位，不含第三方工作室素材。正式设计应替换 Logo、真实作品、品牌色与业务文案。
'''
(OUT / 'README.md').write_text(readme, encoding='utf-8')
print('\n'.join(str(p) for p in OUT.iterdir()))
