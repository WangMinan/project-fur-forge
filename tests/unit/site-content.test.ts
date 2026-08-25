import { describe, expect, it } from 'vitest'
import { structureNumberedPlainText } from '../../app/utils/site-content'

describe('公开长文编号结构', () => {
  it('preserves preface and body text while promoting numbered headings', () => {
    expect(structureNumberedPlainText(`导言

1. 第一节

第一段

第二段

2．第二节\n同段正文`)).toEqual({
      preface: ['导言'],
      sections: [
        { id: 'section-1', number: '1', title: '第一节', paragraphs: ['第一段', '第二段'] },
        { id: 'section-2', number: '2', title: '第二节', paragraphs: ['同段正文'] },
      ],
    })
  })
})
