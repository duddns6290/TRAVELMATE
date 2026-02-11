import { useState } from "react";
import axios from "axios";

const useMemoHandler = ({ schedule, setSchedule, selectedDay, selectedIndex, setModal }) => {
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
                targetGroup = { title: memoTitle, contents: [] };
                target.memos.push(targetGroup);
            }
        }

        const sendToServer = () => {
            const formData = new FormData();
            const memoData = {
                memoTitle: memoTitle || targetMemoTitle || (editingMemoGroup?.title ?? null),
                memoText: textContent || null,
                memoExtraLink: linkContent || null
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
                setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
                resetMemoInput();
            };
            reader.readAsDataURL(imageFile);
            return;
        }

        sendToServer();
        setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
        resetMemoInput();
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
        resetMemoInput,
        handleStartEditMemoGroup,
        isEditMode
    };
};

export default useMemoHandler;
