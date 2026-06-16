export default defineAppConfig({
  pages: [
    'pages/schedule/index',
    'pages/queue/index',
    'pages/repair/index',
    'pages/resource/index',
    'pages/repair-detail/index',
    'pages/repair-create/index',
    'pages/station-detail/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1677FF',
    navigationBarTitleText: '汽修工位排程',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F7FA'
  },
  tabBar: {
    color: '#86909C',
    selectedColor: '#1677FF',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/schedule/index',
        text: '工位排期'
      },
      {
        pagePath: 'pages/queue/index',
        text: '排队叫号'
      },
      {
        pagePath: 'pages/repair/index',
        text: '维修管理'
      },
      {
        pagePath: 'pages/resource/index',
        text: '资源管理'
      }
    ]
  }
})
