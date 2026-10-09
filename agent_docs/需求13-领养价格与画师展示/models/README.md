# 模型说明

- works.artist：可空文本，仅purpose=adoption可有值，trim后1–100字符；0057前向新增，旧值为NULL。
- 管理请求artist可省略，新增省略为NULL，更新省略保留，显式NULL/空白清空；管理DTO回填nullable字段。
- 公开领养目录work.artist仅非空投影；首页和作品目录无此字段。
- 公开详情adoption增加artist（非空时投影）与priceCnyMinor（nullable），状态不影响显隐。
- 价格仍为整数分，数据库币种CNY；不新增金额存储字段。
