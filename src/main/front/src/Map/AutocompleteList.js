const AutocompleteList = ({ list, onSelectPlace }) => {
    return (
        <ul className="autocomplete-list">
            {list.map((item, index) => (
                <li
                    key={index}
                    onClick={() => onSelectPlace(item)}
                >
                    {item.title}
                </li>
            ))}
        </ul>
    );
};
export default AutocompleteList;
