// Tungumál appsins: íslenska (lyklar), enska, víetnamska.
// tr("…") þýðir heila strengi; tölur í strengnum eru normaliseraðar í {n} svo
// "5 manns" → lykill "{n} manns". Txt-hlutinn þýðir sjálfkrafa, aðrir kalla tr().
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";

export type Lang = "is" | "en" | "vi";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "is", label: "Íslenska" },
  { id: "en", label: "English" },
  { id: "vi", label: "Tiếng Việt" },
];
const KEY = "@vakto-lang";
let lang: Lang = (() => {
  try { const c = getLocales()[0]?.languageCode ?? "is"; return c === "en" ? "en" : c === "vi" ? "vi" : "is"; } catch { return "is"; }
})();
const listeners = new Set<() => void>();
export const getLang = () => lang;
export function onLangChange(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
export function setLang(l: Lang) { lang = l; AsyncStorage.setItem(KEY, l).catch(() => {}); listeners.forEach((f) => f()); }
export async function loadLang(): Promise<Lang> {
  try { const v = (await AsyncStorage.getItem(KEY)) as Lang | null; if (v === "is" || v === "en" || v === "vi") { lang = v; listeners.forEach((f) => f()); } } catch { /* ignore */ }
  return lang;
}
export function useLang(): Lang {
  return useSyncExternalStore((l) => onLangChange(l), () => lang, () => lang);
}

type E = [string, string]; // [en, vi]
const D: Record<string, E> = {
  // --- flipar / haus
  "Heim": ["Home", "Trang chủ"], "Vaktir": ["Shifts", "Ca làm"], "Spjall": ["Chat", "Trò chuyện"], "Fréttir": ["News", "Tin tức"], "Ég": ["Me", "Tôi"],
  "Fréttaveita": ["Newsfeed", "Bảng tin"], "Vakt": ["Shift", "Ca làm"], "Laun": ["Pay", "Lương"], "Tímar": ["Hours", "Giờ làm"], "Skírteini": ["ID card", "Thẻ nhân viên"],
  "Skjöl": ["Documents", "Tài liệu"], "Beiðnir": ["Requests", "Yêu cầu"], "Samstarfsfólk": ["Coworkers", "Đồng nghiệp"], "Stillingar": ["Settings", "Cài đặt"],
  "Starfsmaður": ["Employee", "Nhân viên"], "Ráðningarsamningur": ["Employment contract", "Hợp đồng lao động"], "Prófíll": ["Profile", "Hồ sơ"], "Meira": ["More", "Thêm"],
  // --- heim
  "Góða nótt": ["Good night", "Chúc ngủ ngon"], "Góðan daginn": ["Good morning", "Chào buổi sáng"], "Góðan dag": ["Good afternoon", "Chào buổi chiều"], "Gott kvöld": ["Good evening", "Chào buổi tối"],
  "Næsta vakt": ["Next shift", "Ca tiếp theo"], "Næsta vakt · í dag": ["Next shift · today", "Ca tiếp theo · hôm nay"], "Næsta vakt · á morgun": ["Next shift · tomorrow", "Ca tiếp theo · ngày mai"],
  "í dag": ["today", "hôm nay"], "á morgun": ["tomorrow", "ngày mai"], "Í dag": ["Today", "Hôm nay"], "Í gær": ["Yesterday", "Hôm qua"], "Frí": ["Off", "Nghỉ"],
  "Stimpla inn": ["Clock in", "Chấm công vào"], "Stimpla út": ["Clock out", "Chấm công ra"], "Augnablik…": ["One moment…", "Đợi chút…"],
  "Á vakt · síðan {n}": ["On shift · since {n}", "Đang làm · từ {n}"], "Vaktin endar {n}": ["Shift ends {n}", "Ca kết thúc lúc {n}"],
  "Engin vakt á plani — stimplun skráð samt": ["No shift planned — punch recorded anyway", "Không có ca theo lịch — vẫn ghi nhận chấm công"],
  "Engin vakt á plani næstu 3 vikur": ["No shift planned in the next 3 weeks", "Không có ca nào trong 3 tuần tới"],
  "Á vakt með þér í dag": ["On shift with you today", "Làm cùng bạn hôm nay"], "{n} manns": ["{n} people", "{n} người"], "Enginn annar á plani í dag.": ["Nobody else is scheduled today.", "Không có ai khác trong lịch hôm nay."],
  "Lausar vaktir": ["Open shifts", "Ca trống"], "{n} í boði": ["{n} available", "{n} ca trống"], "Biðja um frí": ["Request time off", "Xin nghỉ"], "svar frá vaktstjóra": ["manager replies", "quản lý sẽ trả lời"],
  "Bjóða vakt": ["Offer shift", "Nhường ca"], "skipti við samstarfsfólk": ["swap with a coworker", "đổi ca với đồng nghiệp"], "{n} kr unnið": ["{n} kr earned", "{n} kr đã kiếm"],
  "Tilkynningar": ["Notifications", "Thông báo"], "Allar": ["All", "Tất cả"], "Ekkert nýtt — þú ert með allt á hreinu.": ["Nothing new — you're all caught up.", "Không có gì mới — bạn đã xem hết."], "Ekkert nýtt.": ["Nothing new.", "Không có gì mới."],
  "{n} ólesin skilaboð": ["{n} unread messages", "{n} tin nhắn chưa đọc"], "Opnaðu Spjall": ["Open Chat", "Mở Trò chuyện"],
  "Laus vakt": ["Open shift", "Ca trống"], "Sæktu um í Vaktir → Lausar": ["Apply under Shifts → Open", "Đăng ký ở Ca làm → Ca trống"],
  "Fest tilkynning í fréttaveitu": ["Pinned announcement in the newsfeed", "Thông báo được ghim trên bảng tin"],
  "Orlof": ["Leave", "Nghỉ phép"], "Veikindi": ["Sick leave", "Nghỉ ốm"], "Ólaunað leyfi": ["Unpaid leave", "Nghỉ không lương"], "Ólaunað": ["Unpaid", "Không lương"], "Beiðni": ["Request", "Yêu cầu"],
  "samþykkt": ["approved", "đã duyệt"], "hafnað": ["rejected", "bị từ chối"], "Vaktstjóri samþykkti beiðnina þína": ["Your manager approved your request", "Quản lý đã duyệt yêu cầu của bạn"], "Vaktstjóri hafnaði beiðninni": ["Your manager declined the request", "Quản lý đã từ chối yêu cầu"],
  "Umsókn um vakt": ["Shift application", "Đăng ký ca"], "Vaktaskipti": ["Shift swap", "Đổi ca"],
  "Enginn starfsmannaprófíll tengdur": ["No employee profile linked", "Chưa liên kết hồ sơ nhân viên"],
  "Aðgangurinn þinn er ekki tengdur starfsmanni. Stjórnandi fyrirtækisins þarf að bjóða þér með sama netfangi og er á starfsmannaspjaldinu þínu.": ["Your login isn't linked to an employee. The company admin needs to invite you with the same email as on your employee card.", "Tài khoản của bạn chưa liên kết với nhân viên. Quản lý công ty cần mời bạn bằng đúng email trên hồ sơ nhân viên."],
  "Stimplað inn kl. {n}": ["Clocked in at {n}", "Đã chấm công vào lúc {n}"], "Stimplað út — tímarnir bíða samþykkis": ["Clocked out — hours await approval", "Đã chấm công ra — giờ làm chờ duyệt"],
  "áætlað": ["est.", "ước tính"], "Notandi": ["User", "Người dùng"], "Villa": ["Error", "Lỗi"],
  // --- vaktir
  "Mínar": ["Mine", "Của tôi"], "Lausar": ["Open", "Trống"], "Lausar · {n}": ["Open · {n}", "Trống · {n}"], "Vikan mín": ["My week", "Tuần của tôi"], "{n} klst · {n} vaktir": ["{n} hrs · {n} shifts", "{n} giờ · {n} ca"], "{n} klst · {n} vakt": ["{n} hrs · {n} shift", "{n} giờ · {n} ca"],
  "Engin vakt í dag": ["No shift today", "Hôm nay không có ca"], "Fyrri vika": ["Previous week", "Tuần trước"], "Næsta vika": ["Next week", "Tuần sau"], "{n} á vakt": ["{n} on shift", "{n} đang làm"],
  "Engar vaktir á plani": ["No shifts planned", "Không có ca nào"], "Ekkert skráð þennan dag.": ["Nothing scheduled this day.", "Không có gì trong ngày này."], "Engar lausar vaktir": ["No open shifts", "Không có ca trống"], "Þú færð tilkynningu þegar vakt losnar.": ["You'll be notified when a shift opens up.", "Bạn sẽ được thông báo khi có ca trống."],
  "Áætluð laun fyrir vaktina": ["Estimated pay for this shift", "Lương ước tính cho ca này"], "Sækja um vaktina": ["Apply for this shift", "Đăng ký ca này"], "Sækja um þessa vakt": ["Apply for this shift", "Đăng ký ca này"], "Umsókn send": ["Application sent", "Đã gửi đăng ký"], "Laus": ["Open", "Trống"],
  "Umsókn í bið hjá vaktstjóra": ["Application pending with manager", "Đang chờ quản lý duyệt"], "Umsókn send — vaktstjóri fær tilkynningu": ["Application sent — your manager is notified", "Đã gửi — quản lý sẽ nhận thông báo"],
  "Dagsetning": ["Date", "Ngày"], "Staður": ["Location", "Địa điểm"], "Staða": ["Position", "Vị trí"], "Deild": ["Department", "Bộ phận"], "Laus til umsóknar": ["Open for applications", "Có thể đăng ký"], "Enginn á sama tíma": ["Nobody at the same time", "Không ai cùng giờ"],
  "Á vakt á sama tíma": ["On shift at the same time", "Cùng ca với bạn"], "Allir á vakt": ["Everyone on shift", "Mọi người trong ca"], "Get ekki mætt": ["Can't make it", "Không thể đi làm"], "Deila vakt": ["Share shift", "Chia sẻ ca"], "Senda tíma og stað áfram": ["Forward the time and place", "Gửi giờ và địa điểm"], "Opna spjall": ["Open chat", "Mở trò chuyện"],
  "Senda {x} skilaboð": ["Message {x}", "Nhắn cho {x}"], "Skilaboð til {x}": ["Message {x}", "Nhắn cho {x}"], "Opin vakt": ["Open shift", "Ca trống"], "Dagvinna": ["Regular pay", "Lương cơ bản"], "dagvinna": ["regular", "cơ bản"], "yfirvinna": ["overtime", "tăng ca"], "kvöldálag {n}%": ["evening premium {n}%", "phụ cấp tối {n}%"], "helgarálag {n}%": ["weekend premium {n}%", "phụ cấp cuối tuần {n}%"],
  "Sæki…": ["Loading…", "Đang tải…"], "Þessi starfsmaður er ekki með aðgang að appinu": ["This coworker doesn't have app access", "Đồng nghiệp này chưa có tài khoản ứng dụng"],
  // --- beiðna-sheet
  "Frá": ["From", "Từ"], "Til": ["To", "Đến"], "Senda beiðni": ["Send request", "Gửi yêu cầu"], "Beiðni send — þú færð svar í appinu": ["Request sent — you'll get the answer in the app", "Đã gửi — bạn sẽ nhận câu trả lời trong ứng dụng"],
  "Vaktstjóri fær tilkynningu strax og þú sérð svarið undir Beiðnir.": ["Your manager is notified right away and the answer shows under Requests.", "Quản lý được thông báo ngay và câu trả lời hiện ở mục Yêu cầu."],
  "Bjóða vakt til skipta": ["Offer shift for swap", "Nhường ca để đổi"], "Segðu hvaða vakt þú vilt losna við og hvort þú vilt skipta við einhvern ákveðinn. Vaktstjóri samþykkir skiptin.": ["Say which shift you want to give up and whether you want to swap with someone in particular. Your manager approves the swap.", "Cho biết ca bạn muốn nhường và muốn đổi với ai. Quản lý sẽ duyệt."],
  "Skilaboð": ["Message", "Tin nhắn"], "Senda": ["Send", "Gửi"], "Sent — vaktstjóri og samstarfsfólk sjá boðið": ["Sent — manager and coworkers can see the offer", "Đã gửi — quản lý và đồng nghiệp thấy lời đề nghị"],
  "Býð vaktina {x} til skipta": ["Offering my shift {x} for swap", "Nhường ca {x} để đổi"], "t.d. Býð laugardagsvaktina 11:30–23:00 — Wiktoria getur tekið hana": ["e.g. Offering Saturday 11:30–23:00 — Wiktoria can take it", "vd. Nhường ca thứ Bảy 11:30–23:00 — Wiktoria có thể nhận"],
  "Leiðrétta tíma": ["Correct hours", "Sửa giờ làm"], "Dagur": ["Day", "Ngày"], "Rétt inn": ["Correct in", "Giờ vào đúng"], "Rétt út": ["Correct out", "Giờ ra đúng"], "Skýring": ["Explanation", "Giải thích"], "Gleymdi að stimpla út…": ["Forgot to clock out…", "Quên chấm công ra…"], "Leiðréttingarbeiðni send": ["Correction request sent", "Đã gửi yêu cầu sửa"],
  "Tilkynna forföll": ["Report absence", "Báo nghỉ"], "Vaktstjóri fær tilkynningu strax og getur sett vaktina í „Lausar vaktir“.": ["Your manager is notified immediately and can post the shift as open.", "Quản lý được báo ngay và có thể đưa ca vào mục ca trống."], "Ástæða": ["Reason", "Lý do"], "Veik(ur)…": ["Sick…", "Bị ốm…"], "Tilkynnt — vaktstjóri fær skilaboð núna": ["Reported — your manager gets a message now", "Đã báo — quản lý nhận tin ngay"],
  "Forföll: get ekki mætt {x}": ["Absence: can't make it {x}", "Nghỉ: không thể đi làm {x}"],
  // --- spjall
  "Leita": ["Search", "Tìm kiếm"], "Nýtt spjall": ["New chat", "Trò chuyện mới"], "Leita í spjalli…": ["Search chats…", "Tìm trong trò chuyện…"], "Allt": ["All", "Tất cả"], "Ólesið": ["Unread", "Chưa đọc"], "Ólesið · {n}": ["Unread · {n}", "Chưa đọc · {n}"],
  "Tilkynningar þaggaðar {x}": ["Notifications muted {x}", "Đã tắt thông báo {x}"], "Breyta": ["Change", "Thay đổi"], "Allt lesið": ["All caught up", "Đã đọc hết"], "Engin ólesin skilaboð.": ["No unread messages.", "Không có tin chưa đọc."], "Ekkert fannst": ["Nothing found", "Không tìm thấy"], "Prófaðu annað leitarorð.": ["Try another search.", "Thử từ khóa khác."],
  "Engin samtöl enn": ["No conversations yet", "Chưa có cuộc trò chuyện"], "Ýttu á + til að byrja spjall.": ["Tap + to start a chat.", "Nhấn + để bắt đầu."], "Engin skilaboð enn": ["No messages yet", "Chưa có tin nhắn"], "Þú": ["You", "Bạn"], "Samtal": ["Conversation", "Cuộc trò chuyện"], "Almennt": ["General", "Chung"],
  "📷 Mynd": ["📷 Photo", "📷 Ảnh"], "🎤 Talskilaboð": ["🎤 Voice message", "🎤 Tin nhắn thoại"], "📎 {x}": ["📎 {x}", "📎 {x}"], "Skjal": ["File", "Tệp"], "Mynd": ["Photo", "Ảnh"],
  "Einkaspjall": ["Direct message", "Nhắn riêng"], "Skilaboð til eins samstarfsmanns": ["Message one coworker", "Nhắn cho một đồng nghiệp"], "Nýr hópur": ["New group", "Nhóm mới"], "Veldu nafn og meðlimi": ["Choose a name and members", "Chọn tên và thành viên"], "Til baka": ["Back", "Quay lại"],
  "Sæki samstarfsfólk…": ["Loading coworkers…", "Đang tải đồng nghiệp…"], "Nafn hópsins, t.d. Helgarvaktin": ["Group name, e.g. Weekend crew", "Tên nhóm, vd. Ca cuối tuần"], "MEÐLIMIR · {n} valdir": ["MEMBERS · {n} selected", "THÀNH VIÊN · {n} đã chọn"], "Stofna hóp": ["Create group", "Tạo nhóm"], "Tókst ekki að stofna hóp": ["Couldn't create group", "Không tạo được nhóm"], "Hópurinn „{x}“ stofnaður": ["Group “{x}” created", "Đã tạo nhóm “{x}”"],
  "{n} meðlimir": ["{n} members", "{n} thành viên"], "{n} meðlimir · þaggað": ["{n} members · muted", "{n} thành viên · đã tắt tiếng"], "Einkaspjall · þaggað": ["Direct message · muted", "Nhắn riêng · đã tắt tiếng"], "{x} skrifar…": ["{x} is typing…", "{x} đang nhập…"],
  "Skrifaðu skilaboð…": ["Write a message…", "Nhập tin nhắn…"], "Svara": ["Reply", "Trả lời"], "Svara {x}": ["Reply to {x}", "Trả lời {x}"], "Eyða skilaboðum": ["Delete message", "Xóa tin nhắn"], "Ýttu til að opna": ["Tap to open", "Nhấn để mở"],
  "Þagga spjallið": ["Mute chat", "Tắt tiếng"], "Ekkert ólesið-merki eða hljóð fyrir þetta spjall": ["No unread badge or sound for this chat", "Không hiện chưa đọc hay âm thanh cho cuộc trò chuyện này"], "Kveikja á tilkynningum": ["Unmute", "Bật thông báo"], "Þú færð aftur merki og hljóð": ["Badges and sounds are back on", "Bật lại huy hiệu và âm thanh"],
  "Myndir og skjöl": ["Photos and files", "Ảnh và tệp"], "Allt sem hefur verið sent í spjallinu": ["Everything shared in this chat", "Mọi thứ đã gửi trong cuộc trò chuyện"], "Yfirgefa spjall": ["Leave chat", "Rời trò chuyện"], "Yfirgefa": ["Leave", "Rời"], "Þú hættir að fá skilaboð úr þessu spjalli.": ["You'll stop receiving messages from this chat.", "Bạn sẽ không nhận tin từ cuộc trò chuyện này nữa."],
  "MEÐLIMIR · {n}": ["MEMBERS · {n}", "THÀNH VIÊN · {n}"], "ÞÁTTTAKENDUR": ["PARTICIPANTS", "NGƯỜI THAM GIA"], "Engar myndir eða skjöl enn.": ["No photos or files yet.", "Chưa có ảnh hay tệp."], "Mynd hlóðst ekki upp": ["Photo upload failed", "Không tải được ảnh"], "Skráin hlóðst ekki upp": ["File upload failed", "Không tải được tệp"], "Tókst ekki að senda": ["Couldn't send", "Không gửi được"], "Tókst ekki að senda mynd": ["Couldn't send photo", "Không gửi được ảnh"],
  "Hætta við": ["Cancel", "Hủy"], "Tókst ekki": ["Failed", "Không thành công"], "Ekki innskráð(ur)": ["Not signed in", "Chưa đăng nhập"],
  // --- fréttaveita
  "Ný færsla": ["New post", "Bài viết mới"], "Engar færslur enn": ["No posts yet", "Chưa có bài viết"], "Ýttu á + til að deila því fyrsta með vinnustaðnum.": ["Tap + to share the first one with your workplace.", "Nhấn + để chia sẻ bài đầu tiên."], "FEST EFST": ["PINNED", "ĐÃ GHIM"], "Færslu eytt": ["Post deleted", "Đã xóa bài"],
  "Skrifa athugasemd…": ["Write a comment…", "Viết bình luận…"], "Birtist í fréttaveitu vinnustaðarins. Allir í fyrirtækinu sjá hana og fá push-tilkynningu.": ["Appears in the workplace newsfeed. Everyone in the company sees it and gets a push notification.", "Hiện trên bảng tin. Mọi người trong công ty đều thấy và nhận thông báo."], "Birtist í fréttaveitu vinnustaðarins. Allir í fyrirtækinu sjá hana.": ["Appears in the workplace newsfeed. Everyone in the company sees it.", "Hiện trên bảng tin. Mọi người trong công ty đều thấy."],
  "Hvað viltu segja starfsfólkinu?": ["What do you want to tell the team?", "Bạn muốn nói gì với mọi người?"], "Fjarlægja": ["Remove", "Gỡ"], "Bæta við mynd": ["Add photo", "Thêm ảnh"], "Skipta um mynd": ["Change photo", "Đổi ảnh"], "Úr myndasafni símans": ["From your photo library", "Từ thư viện ảnh"], "Festa efst": ["Pin to top", "Ghim lên đầu"], "Helst efst þar til þú losar hana": ["Stays on top until you unpin it", "Ở trên cùng cho đến khi bỏ ghim"], "Birta": ["Post", "Đăng"], "Birt í fréttaveitu": ["Posted to the newsfeed", "Đã đăng lên bảng tin"], "Tókst ekki að birta": ["Couldn't post", "Không đăng được"],
  "Rétt í þessu": ["Just now", "Vừa xong"], "{n} mín": ["{n} min", "{n} phút"], "{n} klst": ["{n} hrs", "{n} giờ"],
  // --- Ég
  "Laun · {x}": ["Pay · {x}", "Lương · {x}"], "Greitt {x}": ["Paid {x}", "Trả {x}"], "unnið hingað til": ["earned so far", "đã kiếm đến nay"], "unnið hingað til · {n} klst · {n} vaktir": ["earned so far · {n} hrs · {n} shifts", "đã kiếm · {n} giờ · {n} ca"], "unnið hingað til · {n} klst · {n} vakt": ["earned so far · {n} hrs · {n} shift", "đã kiếm · {n} giờ · {n} ca"],
  "Áætlað í mánaðarlok": ["Projected month end", "Dự kiến cuối tháng"], "Áætlað í mánaðarlok m.v. staðfestar vaktir": ["Projected month end based on confirmed shifts", "Dự kiến cuối tháng theo ca đã xác nhận"], "{n} klst eftir á plani · {n} kr": ["{n} hrs still planned · {n} kr", "còn {n} giờ theo lịch · {n} kr"],
  "Starfsmannaskírteini": ["Staff ID card", "Thẻ nhân viên"], "Sýna eða bæta í Wallet": ["Show or add to Wallet", "Xem hoặc thêm vào Wallet"], "Ráðningarsamningur, HACCP, handbækur": ["Contract, HACCP, handbooks", "Hợp đồng, HACCP, sổ tay"], "{n} í bið · {n} alls": ["{n} pending · {n} total", "{n} đang chờ · {n} tổng"], "Frí, vaktaskipti, leiðréttingar": ["Time off, swaps, corrections", "Nghỉ, đổi ca, sửa giờ"],
  "Tímar og stimplanir": ["Hours and punches", "Giờ làm và chấm công"], "{n} klst í {x}": ["{n} hrs in {x}", "{n} giờ trong {x}"], "Stimplanirnar þínar": ["Your punches", "Chấm công của bạn"], "Hverjir vinna með þér": ["Who works with you", "Ai làm cùng bạn"], "Lesa eða undirrita": ["Read or sign", "Đọc hoặc ký"], "Tilkynningar, prófíll, lykilorð": ["Notifications, profile, password", "Thông báo, hồ sơ, mật khẩu"],
  "Skrá út": ["Sign out", "Đăng xuất"], "Viltu skrá þig út?": ["Do you want to sign out?", "Bạn muốn đăng xuất?"],
  // --- laun
  "Kvöld- og helgarálag": ["Evening & weekend premium", "Phụ cấp tối & cuối tuần"], "Yfirvinna": ["Overtime", "Tăng ca"], "Orlof (10,17%)": ["Holiday pay (10.17%)", "Phép năm (10,17%)"], "lagt til hliðar": ["set aside", "để dành"], "Eftir viku": ["By week", "Theo tuần"], "VIKA": ["WEEK", "TUẦN"], "KLST": ["HRS", "GIỜ"], "LAUN": ["PAY", "LƯƠNG"], "· áætlað": ["· projected", "· dự kiến"],
  "Launaseðlar og skjöl": ["Payslips and documents", "Phiếu lương và tài liệu"], "Mánaðarlaun. Endanlegur launaseðill kemur úr launakerfinu.": ["Monthly salary. The final payslip comes from the payroll system.", "Lương tháng. Phiếu lương cuối cùng từ hệ thống lương."],
  "Brúttólaun fyrir staðgreiðslu og lífeyri, reiknuð eftir {x} á tímakaupi {n} kr. Endanlegur launaseðill kemur úr launakerfinu.": ["Gross pay before tax and pension, calculated per {x} at {n} kr/hour. The final payslip comes from the payroll system.", "Lương gộp trước thuế và hưu trí, tính theo {x} với {n} kr/giờ. Phiếu lương cuối cùng từ hệ thống lương."],
  "kjarasamningi {x}": ["the {x} agreement", "thỏa ước {x}"], "reglum fyrirtækisins": ["company rules", "quy định công ty"],
  // --- tímar
  "Þessi mánuður": ["This month", "Tháng này"], "Þessi vika": ["This week", "Tuần này"], "Stimplanir": ["Punches", "Chấm công"], "Engar stimplanir síðustu 45 daga.": ["No punches in the last 45 days.", "Không có chấm công trong 45 ngày qua."], "sími": ["phone", "điện thoại"], "kiosk": ["kiosk", "kiosk"], "Á vakt": ["On shift", "Đang làm"],
  "Biðja um leiðréttingu": ["Request a correction", "Yêu cầu sửa giờ"], "Gleymdirðu að stimpla? Sendu leiðréttingu og vaktstjóri samþykkir. Aðeins samþykktir tímar fara í laun.": ["Forgot to punch? Send a correction and your manager approves it. Only approved hours go to payroll.", "Quên chấm công? Gửi yêu cầu sửa, quản lý sẽ duyệt. Chỉ giờ đã duyệt mới tính lương."],
  // --- skírteini
  "Kennitala": ["ID number", "Số định danh"], "Byrjaði": ["Started", "Bắt đầu"], "Nr.": ["No.", "Số"], "Bæta í Apple Wallet": ["Add to Apple Wallet", "Thêm vào Apple Wallet"], "Bæta í Google Wallet": ["Add to Google Wallet", "Thêm vào Google Wallet"], "Wallet-passinn er á leiðinni": ["The Wallet pass is coming soon", "Thẻ Wallet sắp ra mắt"],
  "Ýttu á kortið til að sjá mynd og allar upplýsingar. QR-kóðann má skanna í kiosk-stimpilklukkunni. Wallet-passar opnast þegar vottorðin frá Apple og Google eru komin.": ["Tap the card to see your photo and all details. The QR code can be scanned at the kiosk time clock. Wallet passes open once the Apple and Google certificates are in place.", "Nhấn vào thẻ để xem ảnh và mọi thông tin. Mã QR quét được ở máy chấm công kiosk. Thẻ Wallet sẽ mở khi có chứng chỉ Apple và Google."],
  "Vinnustaður": ["Workplace", "Nơi làm việc"], "Kennitala félags": ["Company ID number", "Mã số công ty"], "Starfsmannanúmer": ["Employee number", "Mã nhân viên"], "Sími": ["Phone", "Điện thoại"], "Netfang": ["Email", "Email"], "Skanna í kiosk-stimpilklukku": ["Scan at the kiosk time clock", "Quét tại máy chấm công kiosk"],
  // --- stillingar
  "TILKYNNINGAR": ["NOTIFICATIONS", "THÔNG BÁO"], "Push-tilkynningar": ["Push notifications", "Thông báo đẩy"], "Skilaboð, nýtt vaktaplan, svör við beiðnum": ["Messages, new schedules, request replies", "Tin nhắn, lịch mới, trả lời yêu cầu"], "Leyfðu tilkynningar í stillingum símans": ["Allow notifications in your phone settings", "Cho phép thông báo trong cài đặt điện thoại"], "Slökkt á push-tilkynningum": ["Push notifications off", "Đã tắt thông báo đẩy"],
  "EKKI TRUFLA": ["DO NOT DISTURB", "KHÔNG LÀM PHIỀN"], "Þaggað {x}": ["Muted {x}", "Đã tắt {x}"], "Engar push-tilkynningar á meðan": ["No push notifications meanwhile", "Không có thông báo đẩy trong lúc này"], "Kveikja": ["Turn on", "Bật"], "Þagga í 1 klst": ["Mute for 1 hour", "Tắt trong 1 giờ"], "Fyrir fund eða hvíld": ["For a meeting or a break", "Cho cuộc họp hoặc nghỉ ngơi"], "Þagga til morguns": ["Mute until morning", "Tắt đến sáng"], "Kveikist aftur kl. 08:00": ["Back on at 08:00", "Bật lại lúc 08:00"], "Þagga þar til ég kveiki aftur": ["Mute until I turn it on", "Tắt cho đến khi tôi bật lại"], "Þú sérð samt ólesið í appinu": ["You still see unread in the app", "Bạn vẫn thấy tin chưa đọc trong ứng dụng"],
  "Kveikt á tilkynningum aftur": ["Notifications back on", "Đã bật lại thông báo"], "þar til þú kveikir aftur": ["until you turn them on", "cho đến khi bạn bật lại"], "til kl. {n}": ["until {n}", "đến {n}"], "til morguns kl. {n}": ["until tomorrow {n}", "đến {n} sáng mai"],
  "ÚTLIT": ["APPEARANCE", "GIAO DIỆN"], "Fylgir símanum": ["Follow phone", "Theo điện thoại"], "Ljóst": ["Light", "Sáng"], "Dökkt": ["Dark", "Tối"], "Fylgir stillingu símans (núna {x}).": ["Follows the phone setting (currently {x}).", "Theo cài đặt điện thoại (hiện {x})."], "dökkt": ["dark", "tối"], "ljóst": ["light", "sáng"], "Dökkt þema alltaf.": ["Always dark.", "Luôn tối."], "Ljóst þema alltaf.": ["Always light.", "Luôn sáng."],
  "TUNGUMÁL": ["LANGUAGE", "NGÔN NGỮ"], "AÐGANGUR": ["ACCOUNT", "TÀI KHOẢN"], "Sími, netfang, bankareikningur, mynd": ["Phone, email, bank account, photo", "Điện thoại, email, tài khoản ngân hàng, ảnh"], "Breyta lykilorði": ["Change password", "Đổi mật khẩu"], "Sendir hlekk á {x}": ["Sends a link to {x}", "Gửi liên kết đến {x}"], "Sendir hlekk í pósti": ["Sends a link by email", "Gửi liên kết qua email"], "Ekkert netfang skráð": ["No email on file", "Chưa có email"], "Póstur sendur á {x}": ["Email sent to {x}", "Đã gửi email đến {x}"],
  "UM VAKTO": ["ABOUT VAKTO", "VỀ VAKTO"], "Hjálp": ["Help", "Trợ giúp"], "Persónuvernd og skilmálar": ["Privacy and terms", "Quyền riêng tư và điều khoản"],
  // --- samstarfsfólk / starfsmaður
  "Annað": ["Other", "Khác"], "Hringja": ["Call", "Gọi"], "Vaktir næstu tvær vikur": ["Shifts in the next two weeks", "Ca trong hai tuần tới"], "Engar vaktir á plani.": ["No shifts planned.", "Không có ca nào."], "{x} er ekki með aðgang að appinu": ["{x} doesn't have app access", "{x} chưa có tài khoản ứng dụng"],
  // --- login
  "Vaktir, tímar og laun — á einum stað": ["Shifts, hours and pay — in one place", "Ca làm, giờ và lương — tại một nơi"], "Lykilorð": ["Password", "Mật khẩu"], "Skrá inn": ["Sign in", "Đăng nhập"], "Innskráning tókst ekki — athugaðu netfang og lykilorð.": ["Sign-in failed — check your email and password.", "Đăng nhập thất bại — kiểm tra email và mật khẩu."], "Aðgangur er stofnaður af stjórnanda fyrirtækisins í VAKTO.": ["Accounts are created by your company's admin in VAKTO.", "Tài khoản do quản lý công ty tạo trong VAKTO."],
  // --- beiðnir (eldri skjár), skjöl, prófíll, samningur
  "Ný beiðni": ["New request", "Yêu cầu mới"], "Leyfisbeiðni": ["Leave request", "Xin nghỉ"], "Frá (ÁÁÁÁ-MM-DD)": ["From (YYYY-MM-DD)", "Từ (NNNN-TT-NN)"], "Til (ÁÁÁÁ-MM-DD)": ["To (YYYY-MM-DD)", "Đến (NNNN-TT-NN)"], "Senda leyfisbeiðni": ["Send leave request", "Gửi xin nghỉ"], "Óska eftir vaktaskiptum": ["Request a shift swap", "Yêu cầu đổi ca"], "Lýstu hvaða vakt þú vilt skipta og hvenær.": ["Describe which shift you want to swap and when.", "Mô tả ca bạn muốn đổi và khi nào."], "T.d. Get ekki tekið vaktina fös 22.8 — óska eftir skiptum": ["e.g. Can't take Fri 22.8 — looking for a swap", "vd. Không thể làm thứ Sáu 22.8 — cần đổi ca"],
  "Aðgengi": ["Availability", "Thời gian rảnh"], "Hvaða dagar henta þér best á vaktir?": ["Which days suit you best for shifts?", "Ngày nào phù hợp nhất với bạn?"], "Vista aðgengi": ["Save availability", "Lưu thời gian rảnh"], "Beiðnirnar mínar": ["My requests", "Yêu cầu của tôi"], "Í bið": ["Pending", "Đang chờ"], "Samþykkt": ["Approved", "Đã duyệt"], "Hafnað": ["Rejected", "Từ chối"],
  "Skjalasafn": ["Documents", "Tài liệu"], "Skjölin mín": ["My documents", "Tài liệu của tôi"], "Engin sameiginleg skjöl ennþá.": ["No shared documents yet.", "Chưa có tài liệu chung."], "Engin skjöl skráð á þig.": ["No documents on file for you.", "Chưa có tài liệu của bạn."], "Tókst ekki að opna skjal": ["Couldn't open document", "Không mở được tài liệu"],
  "Prófíllinn minn": ["My profile", "Hồ sơ của tôi"], "Upplýsingarnar mínar": ["My details", "Thông tin của tôi"], "Símanúmer": ["Phone number", "Số điện thoại"], "Bankareikningur": ["Bank account", "Tài khoản ngân hàng"], "Vista": ["Save", "Lưu"], "Vistað": ["Saved", "Đã lưu"], "Nafn, kennitala og launakjör eru uppfærð af stjórnanda fyrirtækisins.": ["Name, ID number and pay terms are updated by your company admin.", "Tên, số định danh và lương do quản lý công ty cập nhật."],
  "Undirritaður": ["Signed", "Đã ký"], "Bíður undirritunar": ["Awaiting signature", "Chờ ký"], "Enginn samningur hefur verið sendur á þig ennþá.": ["No contract has been sent to you yet.", "Chưa có hợp đồng nào được gửi cho bạn."], "Undirritun fer fram á vefnum (vakto.is) að sinni.": ["Signing currently happens on the web (vakto.is).", "Hiện tại ký trên web (vakto.is)."],
  // --- dagar / mánuðir
  "Mán": ["Mon", "T2"], "Þri": ["Tue", "T3"], "Mið": ["Wed", "T4"], "Fim": ["Thu", "T5"], "Fös": ["Fri", "T6"], "Lau": ["Sat", "T7"], "Sun": ["Sun", "CN"],
  "mán": ["Mon", "T2"], "þri": ["Tue", "T3"], "mið": ["Wed", "T4"], "fim": ["Thu", "T5"], "fös": ["Fri", "T6"], "lau": ["Sat", "T7"], "sun": ["Sun", "CN"],
  "Mánudagur": ["Monday", "Thứ Hai"], "Þriðjudagur": ["Tuesday", "Thứ Ba"], "Miðvikudagur": ["Wednesday", "Thứ Tư"], "Fimmtudagur": ["Thursday", "Thứ Năm"], "Föstudagur": ["Friday", "Thứ Sáu"], "Laugardagur": ["Saturday", "Thứ Bảy"], "Sunnudagur": ["Sunday", "Chủ Nhật"],
  "janúar": ["January", "tháng 1"], "febrúar": ["February", "tháng 2"], "mars": ["March", "tháng 3"], "apríl": ["April", "tháng 4"], "maí": ["May", "tháng 5"], "júní": ["June", "tháng 6"], "júlí": ["July", "tháng 7"], "ágúst": ["August", "tháng 8"], "september": ["September", "tháng 9"], "október": ["October", "tháng 10"], "nóvember": ["November", "tháng 11"], "desember": ["December", "tháng 12"], "{n} vaktir": ["{n} shifts", "{n} ca"], "{n} vakt": ["{n} shift", "{n} ca"], "{n} alls": ["{n} total", "{n} tổng"],
};

const NUM = /\d[\d.,:–\-]*/g;
export function tr(s: string): string {
  if (lang === "is" || !s) return s;
  const idx = lang === "en" ? 0 : 1;
  const direct = D[s];
  if (direct) return direct[idx];
  // tölur → {n}
  const nums = s.match(NUM);
  if (nums) {
    const key = s.replace(NUM, "{n}");
    const hit = D[key];
    if (hit) { let i = 0; return hit[idx].replace(/\{n\}/g, () => nums[i++] ?? ""); }
  }
  return s;
}
/** Sniðmát með {x}: trf("Sendir hlekk á {x}", email) */
export function trf(key: string, ...vals: (string | number)[]): string {
  const idx = lang === "en" ? 0 : 1;
  const base = lang === "is" ? key : (D[key]?.[idx] ?? key);
  let i = 0;
  return base.replace(/\{[nx]\}/g, () => String(vals[i++] ?? ""));
}
