/**
 * skill-generator-core · archetype 结构化骨架
 * ------------------------------------------------------------------
 * 第一期的 archetype 只是一行 workflow 描述字符串，写在 meta-prompt 里让 AI「参考」。
 * 那是**弱约束**——AI 每次都要重新读文字并自行理解。
 *
 * 这里把它升级为结构化骨架：每个原型定义
 *   - summary / applicableWhen  它是什么、什么时候该用
 *   - stages[]                  阶段清单（每阶段含 intent / mustAsk / actions / output）
 *   - commonRules               骨架级通用铁律
 *   - pitfalls                  该形态的典型误区
 *   - outputRequirements        最终交付必须包含什么
 *
 * 这些字段会**展开进段②段③的 prompt**，成为真正的生成约束：
 *   stages[].mustAsk → 决定 steps 该采集什么
 *   stages[].output  → 决定每步的完成标准
 *   commonRules      → 并入 principles
 *   pitfalls         → 并入 pitfalls
 *
 * 设计铁律：**按「工作形态」切分，不按「行业职能」切分**。
 * 任何行业的工作都能落进这 12 类之一，因此跨领域通用。
 * 反例（已修正）：「估值测算」「税务合规」曾被当作原型，骨架全是标的/折现/税种，
 * 实际是行业职能而非工作形态，已泛化为「测算评估」「合规核查」。
 */

export const ARCHETYPE_SKELETONS = [
  {
    id: 'role_audit',
    label: '审计核查',
    icon: '🔍',
    keyword: '按准则取证、出结论意见',
    example: '盘点存货并出具盘点报告',
    summary: '对被核查对象执行独立取证程序，据此出具结论性意见。',
    applicableWhen: '需要对某个对象按既定准则执行核查程序，并对结论负责（审计、质检、专项检查、评估验收）。',
    stages: [
      { key: 'scope', name: '范围界定', intent: '明确核查对象、期间、依据准则与抽样口径', mustAsk: ['核查对象是什么', '期间与覆盖范围', '依据什么准则或标准', '抽样口径如何确定'], actions: ['确定抽样方式与样本量', '明确排除项与例外情形'], output: '核查范围说明书（含抽样口径与排除项）' },
      { key: 'risk', name: '风险识别', intent: '识别易出问题的环节，确定重点核查领域', mustAsk: ['哪些环节风险最高', '历史问题集中在哪'], actions: ['按环节列出风险点', '按影响与发生可能性排序'], output: '风险清单（按优先级排序）' },
      { key: 'test', name: '控制测试', intent: '对高风险环节执行实质性测试程序', mustAsk: ['测试样本如何选取', '判定标准是什么'], actions: ['执行约定的测试程序', '记录偏离与例外'], output: '测试底稿（逐项留痕）' },
      { key: 'evidence', name: '证据汇总', intent: '把测试结果整理成可追溯的证据链', mustAsk: ['每条结论的证据是什么'], actions: ['建立结论与证据的索引关系', '标记证据不足项'], output: '证据索引表' },
      { key: 'conclude', name: '结论出具', intent: '基于证据给出结论性意见与建议', mustAsk: ['结论适用的前提与限制'], actions: ['出具结论并说明依据', '对问题项给出整改建议'], output: '结论意见 + 问题清单 + 整改建议' },
    ],
    commonRules: [
      '每条结论必须可追溯到具体证据，无法取证时标注「证据不足」而非默认通过',
      '结论必须说明其适用前提与抽样口径，样本外推需注明',
      '发现的问题按影响程度分级，不平铺罗列',
    ],
    pitfalls: ['抽样偏差未被披露', '证据与结论脱节（结论无对应证据）', '把「未发现问题」写成「不存在问题」'],
    outputRequirements: ['结论性意见', '分级问题清单', '证据索引', '抽样口径说明'],
  },
  {
    id: 'role_estimation',
    label: '测算评估',
    icon: '📐',
    keyword: '定量测算、给适用条件',
    example: '测算新设备投资回收期',
    summary: '在明确口径与假设的前提下做定量测算，并给出结果与适用条件。',
    applicableWhen: '需要得出一个量化结果（成本、产能、收益、敞口、进度），且结果会用于决策。',
    stages: [
      { key: 'goal', name: '目标界定', intent: '明确测算什么、按什么口径', mustAsk: ['测算对象与范围', '计算口径与单位', '结果将用于什么决策'], actions: ['固定口径与单位', '明确不测算的部分'], output: '测算口径说明' },
      { key: 'assumption', name: '参数与假设', intent: '确定输入参数及其来源与取值', mustAsk: ['参数有哪些', '每个参数从哪来', '哪些是假设值'], actions: ['区分实测值与假设值', '标注假设的依据'], output: '参数表（含来源与假设标记）' },
      { key: 'compute', name: '定量测算', intent: '按口径执行计算', mustAsk: ['计算规则是否有歧义'], actions: ['逐步计算并留中间结果', '交叉校验关键项'], output: '测算过程与结果' },
      { key: 'sensitivity', name: '敏感性与边界检验', intent: '检验关键假设变动对结果的影响', mustAsk: ['哪些参数最敏感', '结果在什么条件下不成立'], actions: ['做单因素敏感性分析', '找出结论翻转的临界值'], output: '敏感性分析与临界条件' },
      { key: 'conclusion', name: '结论与适用条件', intent: '给出结果并说明其成立的前提', mustAsk: ['结论适用的时间范围与前提'], actions: ['给出结果与区间', '写明不适用情形'], output: '测算结论 + 适用条件与不适用情形' },
    ],
    commonRules: [
      '假设值必须显式标注，估算值与实测值分列呈现',
      '结论必须附敏感性：说明哪些条件变化会推翻它',
      '口径不一致时先对齐口径再计算，不得混用不同口径的数据',
    ],
    pitfalls: ['口径混用（把含税与不含税、不同期间的数据混算）', '只给单点结论不给区间', '敏感性完全缺失'],
    outputRequirements: ['测算结果（含区间）', '参数表（含来源标注）', '敏感性分析', '适用条件与不适用情形'],
  },
  {
    id: 'role_compliance',
    label: '合规核查',
    icon: '✓',
    keyword: '逐条比对规则、标差距',
    example: '核查发票合规性并列出问题',
    summary: '把适用规则逐条与现状比对，标出差距并给出整改动作。',
    applicableWhen: '需要判断某事是否满足外部规则要求（法规、标准、合同、内部制度），并说明差在哪。',
    stages: [
      { key: 'rules', name: '适用规则梳理', intent: '列出本次核查适用的全部规则条款', mustAsk: ['适用哪些规则', '哪一版生效', '适用范围与豁免情形'], actions: ['检索并列出适用条款', '标注条款版本与生效日期'], output: '适用规则清单' },
      { key: 'compare', name: '条款逐条比对', intent: '对每条要求核对现状', mustAsk: ['现状是什么', '证据在哪里'], actions: ['逐条判定符合/不符合/证据不足', '记录判定依据'], output: '逐条比对表' },
      { key: 'gap', name: '差距标记', intent: '把不符合项按严重程度分级', mustAsk: ['不符合项的严重程度', '是否可限期整改'], actions: ['按影响分级', '区分整改项与豁免项'], output: '差距清单（分级）' },
      { key: 'evidence', name: '证据留存', intent: '为每条判定固定支撑材料', mustAsk: ['这份结论会被谁复核'], actions: ['为每条判定关联证据', '记录证据的时间与来源'], output: '证据索引' },
      { key: 'remedy', name: '整改建议', intent: '给出可执行的整改动作', mustAsk: ['整改责任人是谁', '期限要求'], actions: ['给出具体动作与验收标准', '标注无法整改时的替代方案'], output: '整改建议表' },
    ],
    commonRules: [
      '只引用与本次场景实际生效的条款，注明版本与生效日期',
      '判定为「符合」必须有证据支撑，无证据一律标为「证据不足」',
      '规则之间冲突时必须指出冲突并说明采信理由',
    ],
    pitfalls: ['引用了已失效或不适用的条款', '把「未提供材料」当作「符合」', '只给结论不给差距位置'],
    outputRequirements: ['适用规则清单（含版本）', '逐条比对结果', '分级差距清单', '整改建议与证据索引'],
  },
  {
    id: 'role_report',
    label: '分析报告',
    icon: '📊',
    keyword: '从数据出结论与图表',
    example: '输出季度经营分析报告',
    summary: '从数据出发形成有结论、有图表的分析产出。',
    applicableWhen: '需要把数据整理成一份能支撑判断或对外说明的分析材料。',
    stages: [
      { key: 'caliber', name: '口径定义', intent: '固定统计口径与时间范围', mustAsk: ['统计范围与时间窗', '指标口径如何定义'], actions: ['固定指标定义与计算口径', '声明数据边界'], output: '口径说明' },
      { key: 'collect', name: '数据采集', intent: '获取并核对所需数据', mustAsk: ['数据来源', '数据是否完整'], actions: ['校验数据完整性与一致性', '标记缺失值'], output: '数据集（附来源与缺失说明）' },
      { key: 'analyze', name: '分析建模', intent: '用合适的方法分析数据', mustAsk: ['用什么分析方法', '为什么适合'], actions: ['执行分析并保留过程', '做交叉验证'], output: '分析过程与中间结果' },
      { key: 'derive', name: '结论推导', intent: '从分析结果推出结论', mustAsk: ['结论的适用前提', '什么数据会推翻它'], actions: ['由结果推导结论而非由预期倒推', '标注置信度'], output: '核心结论（含前提与置信度）' },
      { key: 'visualize', name: '图表输出', intent: '用图表呈现关键数据', mustAsk: ['读者最关心什么'], actions: ['选择合适的图表类型', '确保图表可独立理解'], output: '图表集 + 一句话结论' },
    ],
    commonRules: [
      '口径先于数据：口径未固定前不得出结论',
      '每个结论必须能追溯到具体数据项',
      '明确区分相关与因果，不得用相关推断因果',
    ],
    pitfalls: ['数据缺失被静默跳过', '结论与图表不一致', '口径中途变更未声明'],
    outputRequirements: ['口径说明', '核心结论（含前提与置信度）', '图表集', '数据来源与局限'],
  },
  {
    id: 'role_decision',
    label: '决策支持',
    icon: '⚖',
    keyword: '比选方案、给建议条件',
    example: '比选三套设备采购方案',
    summary: '围绕一个待决事项生成并比选方案，给出建议与执行条件。',
    applicableWhen: '有多个可选方案、需要权衡、或需要有人拍板但需要系统化依据。',
    stages: [
      { key: 'objective', name: '决策目标锁定', intent: '明确要决什么、成功的判据是什么', mustAsk: ['决策事项是什么', '成功标准', '不可触碰的约束'], actions: ['把目标转成可判定的标准', '列出硬约束'], output: '决策目标与判据' },
      { key: 'options', name: '方案生成', intent: '穷举可行的备选方案', mustAsk: ['有哪些现实可行的选项', '是否可不做'], actions: ['生成不少于三个备选（含维持现状）', '排除不可行方案并说明原因'], output: '备选方案集' },
      { key: 'compare', name: '评估比选', intent: '用统一标准横向比较各方案', mustAsk: ['按哪些维度比', '各维度权重'], actions: ['建立评估矩阵', '标注每个方案的短板'], output: '评估矩阵' },
      { key: 'recommend', name: '建议与执行条件', intent: '给出建议并说明前提', mustAsk: ['建议在什么条件下成立', '何时应重新评估'], actions: ['给出推荐方案与理由', '写明执行条件与复评触发点'], output: '推荐方案 + 执行条件 + 复评触发条件' },
    ],
    commonRules: [
      '必须包含「维持现状/什么都不做」作为备选',
      '评估维度与权重必须先定后评，不能事后调整',
      '建议必须写明在什么条件下会改变推荐',
    ],
    pitfalls: ['只列支持既定结论的方案', '权重设定偏向某一方案', '给出建议但不给执行条件'],
    outputRequirements: ['决策目标与判据', '备选方案集', '评估矩阵', '推荐方案与执行条件'],
  },
  {
    id: 'role_control',
    label: '流程控制',
    icon: '⚙',
    keyword: '定标准、跟状态、处理异常',
    example: '跟踪合同审批进度并催办',
    summary: '定义标准、跟踪状态、处理异常并复盘改进。',
    applicableWhen: '需要让一件事按既定标准持续运转并能被跟踪（流程、SOP、运营管控）。',
    stages: [
      { key: 'standard', name: '标准与流程定义', intent: '明确要做什么、按什么标准做', mustAsk: ['流程的起点与终点', '每个环节的完成标准'], actions: ['定义环节与交付物', '明确角色分工'], output: '流程标准文档' },
      { key: 'tracking', name: '状态跟踪', intent: '持续记录当前处于哪个环节', mustAsk: ['由谁更新状态', '更新频率'], actions: ['定义状态字段与流转规则', '设定超时提醒'], output: '状态跟踪机制' },
      { key: 'exception', name: '异常识别', intent: '发现偏离标准的环节', mustAsk: ['什么情况算异常', '异常分级标准'], actions: ['定义异常判定规则', '自动标记超时与偏离'], output: '异常清单' },
      { key: 'action', name: '处置动作', intent: '对异常执行处置', mustAsk: ['不同异常级别的处置时限', '责任人与升级路径'], actions: ['按级别执行处置', '记录处置过程'], output: '处置记录' },
      { key: 'review', name: '复盘改进', intent: '把反复出现的问题回灌到标准里', mustAsk: ['哪些问题反复出现'], actions: ['分析根因', '更新流程或标准'], output: '复盘报告与标准修订' },
    ],
    commonRules: [
      '每个环节必须有明确完成标准，否则状态无法判定',
      '异常必须分级，不同级别对应不同响应时限',
      '复盘结论必须回写进标准，否则同类问题会重复发生',
    ],
    pitfalls: ['状态长期不更新导致流程实际停滞', '异常被标记但无人处置', '复盘只写不改标准'],
    outputRequirements: ['流程标准文档', '跟踪机制说明', '异常处置记录', '标准修订建议'],
  },
  {
    id: 'role_data',
    label: '数据处理',
    icon: '🗂',
    keyword: '加工原始数据、对质量负责',
    example: '清洗订单数据并输出台账',
    summary: '把原始数据加工成可用结果，并对质量负责。',
    applicableWhen: '主要工作是取数、清洗、转换、汇总，产出是数据或数据表。',
    stages: [
      { key: 'caliber', name: '口径定义', intent: '明确数据范围与计算方式', mustAsk: ['数据范围与时间', '字段含义与单位', '去重与过滤规则'], actions: ['写明字段字典', '固定过滤与去重规则'], output: '取数口径说明' },
      { key: 'clean', name: '清洗加工', intent: '处理脏数据与格式不一致', mustAsk: ['空值与异常值怎么处理', '冲突记录以哪边为准'], actions: ['统一格式与单位', '处理缺失与冲突并留痕'], output: '清洗后的数据集 + 处理日志' },
      { key: 'analyze', name: '统计分析', intent: '按目标做汇总与分布分析', mustAsk: ['要看哪些维度', '用什么统计方法'], actions: ['执行分组汇总与分布分析', '保留可复算的中间结果'], output: '统计结果' },
      { key: 'quality', name: '质量校验', intent: '确认结果可用', mustAsk: ['如何判断数据可信'], actions: ['做总量核对与抽样复核', '评估偏差范围'], output: '质量校验报告' },
      { key: 'output', name: '结果输出', intent: '以可用形式交付', mustAsk: ['谁会用、用来做什么'], actions: ['按使用场景选输出格式', '附口径与质量说明'], output: '结果文件 + 口径与质量说明' },
    ],
    commonRules: [
      '清洗规则必须写成可执行的描述，不能只靠"手动处理"',
      '所有过滤与去重必须留痕，注明影响行数',
      '交付结果必须附口径与已知偏差',
    ],
    pitfalls: ['静默丢行', '单位混用', '汇总口径与明细口径不一致'],
    outputRequirements: ['结果数据', '取数口径说明', '清洗日志', '质量校验结论'],
  },
  {
    id: 'role_content',
    label: '内容生产',
    icon: '✎',
    keyword: '把素材做成结构化成稿',
    example: '起草一份项目立项报告',
    summary: '把素材加工成结构完整、事实准确的成稿。',
    applicableWhen: '主要工作是写、编、改一篇面向读者的内容（文案、报告正文、说明材料、培训材料）。',
    stages: [
      { key: 'material', name: '素材采集', intent: '收集事实、数据与素材', mustAsk: ['受众是谁', '素材来源是否可引用', '有无不可用的信息'], actions: ['核实关键事实与数字', '标记待补充项'], output: '素材清单（已核实/待核实分列）' },
      { key: 'structure', name: '结构组织', intent: '确定成稿的骨架与详略', mustAsk: ['篇幅与结构要求', '最想传达的一条信息'], actions: ['搭建结构大纲', '分配各部分篇幅'], output: '大纲' },
      { key: 'produce', name: '内容生成', intent: '按大纲写出初稿', mustAsk: ['语气与专业度要求'], actions: ['按大纲写作', '保持术语一致'], output: '初稿' },
      { key: 'factcheck', name: '事实校对', intent: '核对数字、引用与表述', mustAsk: ['关键数据是否需外部核实'], actions: ['逐条核对数字与引用', '删除无法证实的内容'], output: '校对记录' },
      { key: 'style', name: '风格统一', intent: '统一语气、格式与术语', mustAsk: ['有无可参照的既有风格'], actions: ['统一术语与格式', '通读润色'], output: '定稿' },
    ],
    commonRules: [
      '数字与引用必须可核实，无法核实的写明不确定',
      '同一概念全文使用同一术语',
      '不为凑字数而增加无信息量的段落',
    ],
    pitfalls: ['用看似合理的内容填补信息空白', '前后术语不一致', '关键数据无来源'],
    outputRequirements: ['定稿', '事实核对记录', '素材来源清单'],
  },
  {
    id: 'role_eval',
    label: '评估打分',
    icon: '⭐',
    keyword: '按指标体系打分定级',
    example: '按评分表给供应商评级',
    summary: '按预设指标体系打分并定级，输出可横向比较的评估结果。',
    applicableWhen: '需要按标准给对象（方案、候选人、产品、风险点等）打分或定级，以便横向比较或分档处理。',
    stages: [
      { key: 'metrics', name: '指标体系', intent: '确定评估维度与判据', mustAsk: ['评估哪些维度', '每个维度的判定标准'], actions: ['定义维度与评分档位', '给出每档的可观察特征'], output: '指标体系表' },
      { key: 'weight', name: '权重设定', intent: '确定各维度的重要程度', mustAsk: ['哪些维度更关键', '是否有历史权重可沿用'], actions: ['设定权重并给出版本号', '锁定本批次权重'], output: '权重方案（含版本号）' },
      { key: 'score', name: '打分计算', intent: '按标准对每个对象评分', mustAsk: ['数据不足时如何处理'], actions: ['逐维度打分并留依据', '数据不足项按保守值处理并标注'], output: '逐维度打分表' },
      { key: 'tier', name: '定级分层', intent: '由分值推出档位', mustAsk: ['各档位阈值', '是否存在一票否决项'], actions: ['套用阈值定档', '先执行否决项判定'], output: '档位结果' },
      { key: 'apply', name: '结果应用', intent: '把评估结果落到具体决策', mustAsk: ['不同档位分别怎么处理'], actions: ['按档位给出差异化动作', '说明调整档位需要什么'], output: '处置建议 + 评估结论' },
    ],
    commonRules: [
      '权重必须版本化，同一批次内不得中途改权',
      '数据不足时按最保守值打分并标注，不得按平均或乐观值补',
      '存在一票否决项时先判定否决，不得用高分抵消',
    ],
    pitfalls: ['权重按结果倒推', '不同批次用不同权重导致不可比', '数据缺失被当作满分或零分'],
    outputRequirements: ['指标体系与权重版本', '逐维度打分与依据', '档位结果', '差异化处置建议'],
  },
  {
    id: 'role_design',
    label: '设计创作',
    icon: '◨',
    keyword: '从需求到具体设计并自检',
    example: '设计一套报账流程界面',
    summary: '从需求理解出发产出具体设计，并自检迭代。',
    applicableWhen: '产出物是设计稿、方案、结构或实物规格（产品设计、装修、流程编排、视觉稿、方案书）。',
    stages: [
      { key: 'understand', name: '需求理解', intent: '把想法变成明确的需求描述', mustAsk: ['要解决什么问题', '给谁用', '约束条件是什么'], actions: ['提炼需求要点', '确认约束与边界'], output: '需求说明' },
      { key: 'conceive', name: '方案构思', intent: '形成多个可行方案', mustAsk: ['有几条可行路径', '哪条更符合目标'], actions: ['生成多个方案', '比较优劣'], output: '候选方案集' },
      { key: 'produce', name: '具体产出', intent: '把选定方案细化为可执行成果', mustAsk: ['细化到什么程度', '交付格式要求'], actions: ['细化为可执行规格', '补齐落地所需细节'], output: '设计产出物' },
      { key: 'iterate', name: '自检迭代', intent: '对照需求与约束自检', mustAsk: ['是否满足全部硬约束'], actions: ['逐条核对约束', '修订并说明改动原因'], output: '修订说明 + 最终产出' },
    ],
    commonRules: [
      '先确认约束再动手，约束不清时不得直接产出',
      '产出必须具体到可执行，"高端大气"这类描述不可接受',
      '每次修订都要说明改了什么、为什么改',
    ],
    pitfalls: ['方案不可落地（缺少尺寸/规格/接口）', '忽略硬约束', '只给一个方案不做比较'],
    outputRequirements: ['需求说明', '候选方案与选定理由', '可执行产出物', '自检清单'],
  },
  {
    id: 'role_monitor',
    label: '监测预警',
    icon: '◉',
    keyword: '持续盯指标、触达即预警',
    example: '盯股价跌破预警线并提醒',
    summary: '持续盯指标，触达阈值即预警并跟踪处置。',
    applicableWhen: '需要长期盯一批指标并在越界时通知与跟进（运维监控、风控预警、质量异常提醒）。',
    stages: [
      { key: 'watch', name: '指标监控', intent: '确定盯哪些指标、怎么取数', mustAsk: ['监控哪些指标', '取数频率', '数据源可靠性'], actions: ['配置指标与采集频率', '校验数据源稳定性'], output: '监控项清单' },
      { key: 'threshold', name: '阈值判定', intent: '定义什么情况算异常', mustAsk: ['阈值怎么定', '有无分级'], actions: ['设定阈值与分级', '区分告警与预警'], output: '阈值规则表' },
      { key: 'alert', name: '预警触发', intent: '越界时发出通知', mustAsk: ['通知谁', '通知渠道与频率', '如何避免告警风暴'], actions: ['按级别路由通知', '合并重复告警'], output: '预警记录' },
      { key: 'track', name: '跟踪处置', intent: '确认预警被处理', mustAsk: ['处置责任人与时限', '未响应怎么办'], actions: ['跟踪处置状态', '对未响应项升级'], output: '处置跟踪表' },
      { key: 'review', name: '复盘改进', intent: '用误报漏报优化阈值', mustAsk: ['哪些是误报', '哪些漏报了'], actions: ['统计误报率漏报率', '调整阈值与规则'], output: '规则优化建议' },
    ],
    commonRules: [
      '阈值必须基于历史数据或明确依据，不凭感觉设定',
      '预警必须分级，避免所有异常同一优先级导致告警疲劳',
      '每条预警必须可追溯到触发它的具体数据',
    ],
    pitfalls: ['阈值过松导致漏报', '告警风暴淹没真正问题', '无处置跟踪，预警形同虚设'],
    outputRequirements: ['监控项与阈值规则', '预警与处置记录', '误报漏报统计', '规则优化建议'],
  },
  {
    id: 'role_dev',
    label: '开发实现',
    icon: '⚑',
    keyword: '把需求变成可运行实现',
    example: '实现一个对账脚本工具',
    summary: '把需求变成可运行、可验证、可交付的实现。',
    applicableWhen: '产出是代码、脚本、配置或可运行的工具。',
    stages: [
      { key: 'breakdown', name: '需求拆解', intent: '把需求拆成可独立完成的任务', mustAsk: ['验收标准是什么', '有哪些非功能要求（性能/兼容/安全）'], actions: ['拆分为任务并排序', '定义每个任务的完成判据'], output: '任务拆解清单' },
      { key: 'design', name: '技术方案', intent: '确定实现结构与关键取舍', mustAsk: ['技术栈约束', '性能或兼容底线'], actions: ['设计模块划分与接口', '识别技术风险'], output: '技术方案（结构 + 关键取舍）' },
      { key: 'code', name: '实现编码', intent: '写出可运行的实现', mustAsk: ['错误处理策略', '依赖如何管理'], actions: ['按模块实现', '处理异常与边界'], output: '可运行代码' },
      { key: 'test', name: '测试验证', intent: '证明它符合验收标准', mustAsk: ['怎么验证', '哪些是边界用例'], actions: ['覆盖正常与边界用例', '对照验收标准逐条核验'], output: '测试结果 + 用例' },
      { key: 'deploy', name: '交付部署', intent: '让它在真实环境跑起来', mustAsk: ['怎么启动', '出错了怎么排查'], actions: ['提供启动与说明', '交付可复现的构建方式'], output: '交付包 + 运行说明' },
    ],
    commonRules: [
      '每个任务必须先有可验证的完成判据再动手',
      '错误处理不是事后补，必须与功能同时实现',
      '交付物必须能被他人独立跑起来',
    ],
    pitfalls: ['只实现正常路径，边界与错误未处理', '硬编码环境相关配置', '交付后无法复现构建'],
    outputRequirements: ['可运行实现', '技术方案说明', '测试用例与结果', '运行与部署说明'],
  },
]

/** id → 骨架 的快速索引 */
export const SKELETON_BY_ID = new Map(ARCHETYPE_SKELETONS.map(s => [s.id, s]))

export function isValidArchetype(id) {
  return SKELETON_BY_ID.has(id)
}

/**
 * 把骨架展开成注入 prompt 的文本。
 * 这是「载入」真正发生的地方——结构化骨架在这里变成模型可读的约束。
 */
export function renderSkeleton(id) {
  const s = SKELETON_BY_ID.get(id)
  if (!s) return ''
  const lines = []
  lines.push(`工作形态：${s.id}（${s.label}）—— ${s.summary}`)
  lines.push(`适用：${s.applicableWhen}`)
  lines.push('阶段骨架（steps 与 workflow 节点必须按此划分与排序）：')
  s.stages.forEach((st, i) => {
    lines.push(`  阶段${i + 1} ${st.name}（${st.key}）：${st.intent}`)
    lines.push(`    必采信息：${st.mustAsk.join('；')}`)
    lines.push(`    关键动作：${st.actions.join('；')}`)
    lines.push(`    该阶段产出：${st.output}`)
  })
  lines.push(`骨架通用铁律（应并入技能的原则）：${s.commonRules.join(' ')}`)
  lines.push(`该形态典型误区（应并入技能的陷阱）：${s.pitfalls.join('；')}`)
  lines.push(`最终交付必须包含：${s.outputRequirements.join('；')}`)
  return lines.join('\n')
}

// ======================================================================
// 独立「工作形态」步骤用的短字段与启发式推荐（2026-10-11）
// ======================================================================

/**
 * 卡片的**视觉呈现数据源**。
 *
 * ## 为什么不直接用 summary / applicableWhen
 * 用户实测反馈第一版卡片「很丑、字太多、眼花缭乱」——
 * 根因是卡片正文取的是 `note`，而那个 note **由模型生成、长度不受我们控制**，
 * 实际会写出 3-4 行长句（见真实截图）。
 * 所以卡片只用下面这三个**我们自己维护的短字段**：
 *   icon      单个符号，视觉锚点
 *   keyword   6-10 字，一眼看清「这活是干什么的」
 *   example   一个具体例子，hover 时显示
 *
 * summary / applicableWhen 仍然保留 —— 它们是**给模型读的**，
 * 出现在 prompt 里给 AI 判断依据，不进 UI。
 */
export const ARCHETYPE_CARDS = ARCHETYPE_SKELETONS.map(a => ({
  id: a.id, label: a.label, icon: a.icon, keyword: a.keyword, example: a.example,
}))

/**
 * 形态推荐关键词：每个词的权重就是它自己的长度，全部命中求和。
 *
 * ⚠️ **同一个词不要出现在两个形态的词表里**（2026-10-11 实测踩到）：
 * 「对供应商的发票进行合规性核查」→ audit 独占「核查」、compliance 独占「合规」，
 * 两边各得 2 分平手，求和也救不了 —— 最后仍按词表顺序推出 audit。
 * 这类「两形态共用的通用动词」要从**弱专属形态**里删掉，只留在**强专属形态**里：
 *   - 「核查」：audit 的强专属词是「审计/取证/底稿/盘点」→ 通用「核查」从 audit 删掉
 *   - 通用动词（「核查」「分析」「处理」）若确实两形态都需要，**两边都不放**，
 *     宁可少命中，也不要给出一个错的默认落点。
 */
const ARCHETYPE_HINTS = {
  role_audit:       ['审计', '盘点', '取证', '复核', '鉴证', '底稿'],
  role_estimation:  ['测算', '评估', '估价', '定量', '金额', '测算模型', '成本'],
  role_compliance:  ['合规', '监管', '法规', '内控', '制度', '规范', '条例', '年检'],
  role_report:      ['报告', '分析', '报表', '总结', '梳理', '汇报', '洞察'],
  role_decision:    ['决策', '建议', '选型', '比选', '方案', '取舍', '拍板'],
  role_control:     ['流程', '审批', '流转', '跟踪', '进度', '催办', '状态'],
  role_data:        ['数据', '清洗', '录入', '台账', '整理', '转换', '字段'],
  role_content:     ['撰写', '起草', '文案', '成稿', '撰写材料', '编制'],
  role_eval:        ['评分', '打分', '评级', '评估表', '考核', '打分卡'],
  role_design:      ['设计', '界面', '原型', '布局', '视觉', '交互稿'],
  role_monitor:     ['监控', '预警', '盯', '监测', '告警', '持续跟踪', '看板'],
  role_dev:         ['开发', '实现', '代码', '脚本', '自动化', '工具', '小程序'],
  // ⚠️ 2026-10-11 用户反馈「进入工作形态里以后没有推荐」。实测根因：
  //   用户填的「财务」这类**领域名**不在任何形态的词表里 → suggestArchetype 返回 null
  //   → 12 张卡按词表原序铺开，没有任何推荐标记。
  //   原词表只覆盖「做什么」（动词+宾语），没覆盖「哪个领域」。
  //   补「领域 → 默认形态」的弱映射（权重 = 词长 = 2），只在没有更强命中时兜底。
  role_data:        ['财务', '记账', '账单', '报销', '应收', '应付', '台账', '对账', '清单'],
  role_report:      ['运营', '市场', '销售', '经营', '统计'],
  role_eval:        ['人事', '绩效', '招聘', '考核'],
  role_content:     ['宣传', '文案', '编辑', '内容运营'],
}

/**
 * 从工作事项（brief）启发式推荐一个工作形态。
 *
 * ## 为什么需要它（以及它的局限）
 * 形态选择被从「问卷第 1 题」提到「独立一步」后，**问卷答案还不存在**，
 * 而 prompt 里原本要求「根据前面各题的用户回答判断最贴近的一项」——
 * 那条推荐能力会随之丢失。
 * 所以用已填的 brief（领域/背景/目标/痛点）做关键词匹配做**兜底推荐**。
 *
 * ⚠️ **这是启发式，不是模型判断**：准确率明显低于「读完 9 道题再推荐」。
 * 它的价值是给用户一个**默认落点**（用户往往直接点它），而不是替用户决定。
 * 完全匹配不上时返回 null —— 不硬猜。
 *
 * @returns {{id:string,score:number}|null}
 */
export function suggestArchetype(form) {
  const text = [form?.domain, form?.agentName, form?.taskBackground,
    form?.goals, form?.painPoints, form?.skillLibrary]
    .filter(Boolean).join(' ').toLowerCase()
  if (!text.trim()) return null
  // ⭐ 计分改成「**所有命中词求和**」，不是只取最长的那一个。
  // 第一版用「最长命中优先」，实测两个案例都推错：
  //   「对供应商的发票进行**合规**性**核查**」→ audit 命中「核查」(2)、
  //     compliance 命中「合规」(2)，**等长平手** → 逻辑退化成「谁在词表里靠前谁赢」，
  //     推出 role_audit，而正确答案显然是 compliance。
  //   「**设计**报账**流程**的**界面原型**」→ control 命中「流程」(1 词)、
  //     design 命中「设计/界面/原型」(3 词)，只比最长词长 → 同样错。
  // 改成求和后：compliance = 2+2 = 4 > audit = 2；design = 2*3 = 6 > control = 2。
  let best = null
  let bestScore = 0
  for (const a of ARCHETYPE_SKELETONS) {
    let score = 0
    let longest = 0
    for (const k of ARCHETYPE_HINTS[a.id] || []) {
      if (!text.includes(k.toLowerCase())) continue
      // 命中一个长词比命中一个短词更有说服力 → 每个词的权重就是它自己的长度
      score += k.length
      if (k.length > longest) longest = k.length
    }
    if (score > bestScore) { best = a; bestScore = score; }
  }
  return best ? { id: best.id, score: bestScore } : null
}

/**
 * 按推荐排序卡片：**推荐项始终排首位**，其余保持词表原序。
 * ⚠️ 置顶是硬要求（2026-10-11 用户明确要求「把推荐的始终放在首位」）：
 * 12 张卡里推荐项若在第 8 位，用户会先滚动去找它，等于没有推荐。
 */
export function orderCardsForSuggestion(cards, suggestedId) {
  if (!suggestedId) return cards
  const hit = cards.find(c => c.id === suggestedId)
  return hit ? [hit, ...cards.filter(c => c.id !== suggestedId)] : cards
}
