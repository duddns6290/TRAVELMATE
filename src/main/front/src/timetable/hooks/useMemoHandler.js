import { useState } from "react";
import axios from "axios";

const useMemoHandler = ({ schedule, setSchedule, selectedDay, selectedIndex, setModal, applyAndBroadcast, userId }) => {
    const [memoTitle, setMemoTitle] = useState("");
    const [textContent, setTextContent] = useState("");
    const [linkContent, setLinkContent] = useState("");
    const [imageFile, setImageFile] = useState(null);

    const [isAddingToExisting, setIsAddingToExisting] = useState(false);
    const [targetMemoTitle, setTargetMemoTitle] = useState("");

    const [isEditMode, setIsEditMode] = useState(false);
    const [editingMemoGroup, setEditingMemoGroup] = useState(null);

    const resetMemoInput = () => {
        setMemoTitle("");
        setTextContent("");
        setLinkContent("");
        setImageFile(null);
        setTargetMemoTitle("");
        setIsAddingToExisting(false);
        setIsEditMode(false);
        setEditingMemoGroup(null);
        setModal(null);
    };

    const handleAddOrEditMemo = () => {
        const arr = [...schedule[selectedDay]];
        const target = arr[selectedIndex];
        if (!target) return;

        let targetGroup;

        if (isEditMode && editingMemoGroup) {
            // ✅ 기존 메모 그룹 수정
            targetGroup = target.memos.find(m => m.title === editingMemoGroup.title);
            if (!targetGroup) return;
            targetGroup.contents = []; // 기존 내용 제거 후 덮어씀
        } else {
            // ✅ 새 메모 그룹 추가 or 기존 메모 그룹에 추가
            if (isAddingToExisting && targetMemoTitle) {
                targetGroup = target.memos.find(m => m.title === targetMemoTitle);
            } else {
                if (!memoTitle) return;
                targetGroup = { title: memoTitle, contents: [], userId: userId || null };
                target.memos.push(targetGroup);
            }
        }

        const sendToServer = () => {
            const formData = new FormData();
            const memoData = {
                memoTitle: memoTitle || targetMemoTitle || (editingMemoGroup?.title ?? null),
                memoText: textContent || null,
                memoExtraLink: linkContent || null,
                userId: userId || null // 작성자별 메모 색상 구분용
            };
            formData.append("memo", new Blob([JSON.stringify(memoData)], { type: "application/json" }));
            if (imageFile) formData.append("image", imageFile);

            axios.post(`http://localhost:8080/memos/place/${target.id}/memo`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            }).then(() => console.log(isEditMode ? "메모 수정 성공" : "메모 저장 성공"))
                .catch(err => console.error("메모 저장 실패", err));
        };

        if (textContent) targetGroup.contents.push({ type: "text", content: textContent });
        if (linkContent) targetGroup.contents.push({ type: "link", content: linkContent });

        if (imageFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const imageData = reader.result;
                targetGroup.contents.push({ type: "image", content: imageData });
                sendToServer(imageData);
                applyAndBroadcast("MEMO_UPDATE", target.id, { selectedDay, memos: target.memos });
                resetMemoInput();
            };
            reader.readAsDataURL(imageFile);
            return;
        }

        sendToServer();
        applyAndBroadcast("MEMO_UPDATE", target.id, { selectedDay, memos: target.memos });
        resetMemoInput();
    };

    // 메모 패널 안의 인라인 양식에서 바로 새 메모를 추가한다.
    // 성공하면 true를 돌려주고, 패널은 열린 채로 새 메모가 그 자리에 나타난다.
    const addMemoInline = async ({ text, link, imageFile: file }) => {
        const target = schedule[selectedDay]?.[selectedIndex];
        if (!target) return false;

        const contents = [];
        if (text) contents.push({ type: "text", content: text });
        if (link) contents.push({ type: "link", content: link });
        if (file) {
            const dataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            contents.push({ type: "image", content: dataUrl });
        }

        const formData = new FormData();
        // 메모 제목은 쓰지 않는다 (작성자별 메모 1개)
        const memoData = {
            memoText: text || null,
            memoExtraLink: link || null,
            userId: userId || null
        };
        formData.append("memo", new Blob([JSON.stringify(memoData)], { type: "application/json" }));
        if (file) formData.append("image", file);

        let memoId = null;
        try {
            const res = await axios.post(`http://localhost:8080/memos/place/${target.id}/memo`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            memoId = res.data?.memoId ?? null;
        } catch (err) {
            if (err.response?.status === 409) {
                alert("이 장소에는 이미 내 메모가 있어요. 기존 메모를 수정해주세요.");
                return false;
            }
            console.error("메모 저장 실패", err);
            alert("메모 저장 중 오류가 발생했습니다.");
            return false;
        }

        const memos = [...(target.memos || []), { memoId, contents, userId: userId || null }];
        applyAndBroadcast("MEMO_UPDATE", target.id, { selectedDay, memos });
        return true;
    };

    // 본인 메모를 그 자리에서 수정한다. (내용/링크만, 사진은 유지)
    const updateMemoInline = async ({ memoId, text, link }) => {
        const target = schedule[selectedDay]?.[selectedIndex];
        if (!target || !memoId) return false;

        try {
            await axios.put(`http://localhost:8080/memos/${memoId}`, {
                memoText: text || null,
                memoExtraLink: link || null,
            }, { params: { userId } });
        } catch (err) {
            if (err.response?.status === 403) {
                alert("본인이 작성한 메모만 수정할 수 있어요.");
                return false;
            }
            console.error("메모 수정 실패", err);
            alert("메모 수정 중 오류가 발생했습니다.");
            return false;
        }

        const memos = (target.memos || []).map(m => {
            if (m.memoId !== memoId) return m;
            const images = (m.contents || []).filter(c => c.type === "image");
            const contents = [];
            if (text) contents.push({ type: "text", content: text });
            if (link) contents.push({ type: "link", content: link });
            return { ...m, contents: [...contents, ...images] };
        });
        applyAndBroadcast("MEMO_UPDATE", target.id, { selectedDay, memos });
        return true;
    };

    const handleStartEditMemoGroup = (memoGroup) => {
        setIsEditMode(true);
        setEditingMemoGroup(memoGroup);
        setMemoTitle(memoGroup.title); // 제목 미리 채우기

        // ✅ 기존 메모 내용 중 text, link만 불러오기
        const text = memoGroup.contents.find(c => c.type === "text");
        const link = memoGroup.contents.find(c => c.type === "link");

        setTextContent(text?.content || "");
        setLinkContent(link?.content || "");
        setImageFile(null); // 이미지도 수정 가능하게 하려면 따로 처리 가능

        setModal("memo"); // 수정 모달 띄우기
    };


    return {
        memoTitle, setMemoTitle,
        textContent, setTextContent,
        linkContent, setLinkContent,
        imageFile, setImageFile,
        isAddingToExisting, setIsAddingToExisting,
        targetMemoTitle, setTargetMemoTitle,
        handleAddOrEditMemo,
        addMemoInline,
        updateMemoInline,
        resetMemoInput,
        handleStartEditMemoGroup,
        isEditMode
    };
};

export default useMemoHandler;
