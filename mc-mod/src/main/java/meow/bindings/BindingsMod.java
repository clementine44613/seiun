package meow.bindings;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import net.fabricmc.api.ModInitializer;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.WorldSavePath;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

public class BindingsMod implements ModInitializer {
    private static volatile long lastFileCheck = 0;
    private static volatile Map<String, Entry> cachedBindings = Map.of();
    private static final Object lock = new Object();
    private static final Gson GSON = new Gson();
    private static final Type MAP_TYPE = new TypeToken<Map<String, Entry>>() {}.getType();

    @Override
    public void onInitialize() {
    }

    public static String getBindingForUsername(String username, MinecraftServer server) {
        if (server == null) return null;
        Map<String, Entry> map = loadBindings(server);
        if (map == null) return null;
        String lower = username.toLowerCase();
        for (Entry entry : map.values()) {
            if (entry != null && entry.username != null && entry.username.toLowerCase().equals(lower)) {
                return entry.username;
            }
        }
        return null;
    }

    public static Map<String, Entry> loadBindings(MinecraftServer server) {
        long now = System.currentTimeMillis();
        if (now - lastFileCheck < 5000) {
            return cachedBindings;
        }
        synchronized (lock) {
            if (now - lastFileCheck < 5000) {
                return cachedBindings;
            }
            try {
                if (server == null) {
                    return cachedBindings;
                }
                Path path = server.getSavePath(WorldSavePath.ROOT).resolve("bindings.json");
                if (Files.exists(path)) {
                    try (BufferedReader reader = Files.newBufferedReader(path)) {
                        Map<String, Entry> map = GSON.fromJson(reader, MAP_TYPE);
                        cachedBindings = map != null ? map : Map.of();
                    }
                } else {
                    cachedBindings = Map.of();
                }
                lastFileCheck = now;
            } catch (Exception e) {
                return cachedBindings;
            }
        }
        return cachedBindings;
    }

    public static void kickPlayer(ServerPlayerEntity player, String reason) {
        MinecraftServer server = ((ServerPlayerEntityAccessor) player).getServer();
        server.execute(() -> {
            if (player.isDisconnected()) return;
            player.networkHandler.disconnect(net.minecraft.text.Text.literal(reason));
        });
    }

    private static class Entry {
        String username;
        long lastVerified;
    }
}

@Mixin(ServerPlayerEntity.class)
interface ServerPlayerEntityAccessor {
    @Accessor("server")
    MinecraftServer getServer();
}

@Mixin(net.minecraft.server.network.ServerPlayerEntity.class)
class ServerPlayerEntityMixin {
    @Inject(at = @At("TAIL"), method = "<init>")
    private void meow$onConstruct(CallbackInfo ci) {
        ServerPlayerEntity player = (ServerPlayerEntity) (Object) this;
        String username = player.getName().getString();
        String binding = BindingsMod.getBindingForUsername(username, ((ServerPlayerEntityAccessor) player).getServer());
        if (binding == null) {
            BindingsMod.kickPlayer(player, "You are not bound to this Minecraft username.");
        }
    }
}
