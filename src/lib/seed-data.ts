import {
  AdminSiteSettings,
  MemoryItem,
  PublicSiteSettings,
  SiteSettings,
} from '@/types/memories';

export interface LocalDbSchema {
  settings: SiteSettings;
  memories: MemoryItem[];
}

export function createInitialSeedData(): LocalDbSchema {
  const now = new Date().toISOString();
  return {
    settings: {
      coupleTitle: 'Anh & Em',
      heroSubtitle:
        'Gửi em — người đã biến những ngày bình thường nhất thành kỷ niệm rực rỡ nhất của chúng ta.',
      loveStartDate: '2024-10-12',
      musicUrl: '/samples/gentle-memories.wav',
      musicEnabled: true,
      letterTitle: 'Gửi người thương của anh,',
      letterBody:
        'Cảm ơn em vì đã bước vào cuộc đời anh thật dịu dàng, đã kiên nhẫn lắng nghe những câu chuyện vụn vặt và cùng anh đi qua biết bao mùa nắng mưa.\n\nCó những bức ảnh cũ mình chụp vội đến mức hơi nhòe, nhưng mỗi lần nhìn lại anh vẫn nhớ nguyên cảm giác bình yên khi có bàn tay em nắm lấy tay anh lúc ấy.\n\nChặng đường phía trước vẫn còn rất dài, mong rằng sau này dù bận rộn đến đâu, tụi mình vẫn luôn dành cho nhau sự dịu dàng như những ngày đầu tiên nhé.',
      letterSignature: 'Thương em thật nhiều,\nAnh của em ♥',
      viewerPasscodeEnabled: false,
      viewerPasscodeHash: '',
      updatedAt: now,
    },
    memories: [
      {
        id: '11111111-1111-4111-8111-111111111101',
        memoryDate: '2024-10-12',
        title: 'Buổi chiều mưa đầu tiên',
        story:
          'Hai đứa trú mưa trong quán cà phê nhỏ góc phố, gọi hai ly trà ấm và nói chuyện suốt buổi chiều mà quên cả giờ về.',
        imageUrl: '/samples/memory-1.svg',
        imageAlt: 'Hai tách trà ấm trong chiều mưa đầu tiên',
        sortOrder: 0,
        createdAt: now,
      },
      {
        id: '11111111-1111-4111-8111-111111111102',
        memoryDate: '2025-01-19',
        title: 'Chuyến đi ngắm hoàng hôn',
        story:
          'Lần đầu tiên cùng nhau đón nắng chiều trên triền đồi. Gió hơi lạnh nhưng nụ cười của em lúc đó làm cả khung trời ấm hẳn lên.',
        imageUrl: '/samples/memory-2.svg',
        imageAlt: 'Hoàng hôn vàng dịu trên triền đồi',
        sortOrder: 1,
        createdAt: now,
      },
      {
        id: '11111111-1111-4111-8111-111111111103',
        memoryDate: '2025-06-08',
        title: 'Đêm dạo biển lộng gió',
        story:
          'Đi bộ chân trần dọc bờ cát nghe tiếng sóng vỗ, hai đứa hứa với nhau năm sau nhất định sẽ quay lại nơi này thêm nhiều lần nữa.',
        imageUrl: '/samples/memory-3.svg',
        imageAlt: 'Ánh trăng sáng soi trên mặt biển đêm yên bình',
        sortOrder: 2,
        createdAt: now,
      },
      {
        id: '11111111-1111-4111-8111-111111111104',
        memoryDate: '2026-02-14',
        title: 'Bó hoa nhỏ ngày đặc biệt',
        story:
          'Không cần quà cầu kỳ, chỉ một bó hoa pastel nhẹ nhàng và bữa tối tự nấu — vậy là đủ trọn vẹn một ngày đáng nhớ.',
        imageUrl: '/samples/memory-4.svg',
        imageAlt: 'Bó hoa pastel dịu dàng kỷ niệm',
        sortOrder: 3,
        createdAt: now,
      },
    ],
  };
}

export function stripSettingsForPublic(settings: SiteSettings): PublicSiteSettings {
  const { viewerPasscodeHash: _hidden, ...publicSettings } = settings;
  return publicSettings;
}

export function stripSettingsForAdmin(settings: SiteSettings): AdminSiteSettings {
  const { viewerPasscodeHash, ...rest } = settings;
  return {
    ...rest,
    hasViewerPasscode: Boolean(viewerPasscodeHash),
  };
}
