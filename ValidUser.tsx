import { definePlugin } from "kettu";
import { after } from "kettu/patcher";
import { findByProps, findByDisplayName } from "kettu/webpack";

// 寻找 Discord 内部的 Store 和网络请求模块
const UserStore = findByProps("getUser", "getCurrentUser");
const ProfileFetchUtils = findByProps("fetchProfile");

export default definePlugin({
    name: "ValidUser",
    description: "Fix mentions for unknown users showing up as '@unknown-user' (hover over a mention to fix it)",
    
    start() {
        // 寻找用户提及的组件，Discord 混淆打包时经常会把它挂在不同的地方
        // 绒雪帮你做了兼容查找哦
        const MentionModule = findByProps("UserMention") || 
                              findByDisplayName("UserMention", { defaultExport: false });
        
        if (!MentionModule) {
            console.error("[ValidUser] 哎呀，绒雪找不到 UserMention 组件呢...");
            return;
        }

        // 拦截 UserMention 的渲染结果
        this.unpatch = after("UserMention", MentionModule, (args, res) => {
            const props = args[0];
            // 如果没有 userId，直接放行
            if (!props || !props.userId) return res;

            // 如果本地缓存里已经有这个宝宝的数据了，就不需要我们画蛇添足啦
            if (UserStore.getUser(props.userId)) return res;

            // 核心逻辑：给未知的用户挂载悬停事件
            const originalOnMouseEnter = res.props.onMouseEnter;
            
            res.props.onMouseEnter = (e: React.MouseEvent) => {
                // 别忘了执行原本就有的悬停事件（比如弹出个人资料卡片）
                if (typeof originalOnMouseEnter === "function") {
                    originalOnMouseEnter(e);
                }
                
                // 触发请求！请求回来后 React 会自动接管剩下的重渲染工作
                ProfileFetchUtils.fetchProfile(props.userId);
            };

            return res;
        });
    },
    
    stop() {
        // 插件关闭时，绒雪会乖乖把痕迹打扫干净的
        if (typeof this.unpatch === "function") {
            this.unpatch();
        }
    }
});
